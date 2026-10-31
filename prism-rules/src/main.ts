import {
  OpticalPiece,
  OpticalItemType,
  LevelDefinition,
  Point
} from './engine/types.ts';
import { LEVELS } from './engine/levels.ts';
import { LightPhysicsEngine, dist } from './engine/lightPhysics.ts';
import { BoardRenderer } from './renderer/boardRenderer.ts';
import { LightRenderer } from './renderer/lightRenderer.ts';
import { GizmoRenderer } from './renderer/gizmoRenderer.ts';
import { HUD } from './ui/hud.ts';
import { ModalManager } from './ui/modal.ts';
import { sounds } from './audio.ts';

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private customCursor: HTMLElement;

  private currentLevelIndex: number = 0;
  private currentLevel: LevelDefinition;
  private currentInventory: Record<OpticalItemType, number> = {
    prism: 0,
    green: 0,
    lens: 0,
    mirror: 0
  };

  private pieces: OpticalPiece[] = [];
  private selectedPiece: OpticalPiece | null = null;
  private physicsEngine: LightPhysicsEngine;
  private boardRenderer: BoardRenderer;
  private lightRenderer: LightRenderer;
  private gizmoRenderer: GizmoRenderer;
  private hud: HUD;
  private modals: ModalManager;

  // Interaction state
  private isDraggingPiece: boolean = false;
  private isRotatingPiece: boolean = false;
  private dragOffset: Point = { x: 0, y: 0 };
  private mousePos: Point = { x: 0, y: 0 };

  // Game Loop & FPS
  private lastTime: number = 0;
  private fps: number = 60;
  private solvedTimer: number = 0;
  private isLevelSolved: boolean = false;
  private previousLitTargets: Set<string> = new Set();

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.customCursor = document.getElementById('custom-cursor')!;

    this.physicsEngine = new LightPhysicsEngine();
    this.boardRenderer = new BoardRenderer();
    this.lightRenderer = new LightRenderer();
    this.gizmoRenderer = new GizmoRenderer();
    this.hud = new HUD();
    this.modals = new ModalManager();

    // Default to level 70 ("the assay") as requested
    const level70Index = LEVELS.findIndex(l => l.id === 70);
    this.currentLevelIndex = level70Index >= 0 ? level70Index : 0;
    this.currentLevel = LEVELS[this.currentLevelIndex];

    this.setupCanvasDPI();
    this.setupEventListeners();
    this.setupHUDCallbacks();
    this.loadLevel(this.currentLevel);

    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private setupCanvasDPI() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = 900 * dpr;
    this.canvas.height = 900 * dpr;
    this.ctx.scale(dpr, dpr);
  }

  private setupHUDCallbacks() {
    this.hud.onSelectSlot = (_type) => {
      // Slot selected for placement
    };

    this.hud.onRestart = () => {
      this.loadLevel(this.currentLevel);
    };

    this.hud.onSolution = () => {
      this.loadLevelSolution();
    };

    this.hud.onOpenLevels = () => {
      this.modals.showLevels(this.currentLevel.id);
    };

    this.hud.onToggleAudio = () => {
      const isMuted = sounds.toggleMute();
      this.hud.updateAudioIcon(isMuted);
    };

    this.modals.onReplay = () => {
      this.loadLevel(this.currentLevel);
    };

    this.modals.onFreePlay = () => {
      const sbLevel = LEVELS.find(l => l.id === 999);
      if (sbLevel) this.loadLevel(sbLevel);
    };

    this.modals.onNextLevel = () => {
      if (this.currentLevelIndex + 1 < LEVELS.length) {
        this.currentLevelIndex++;
        this.loadLevel(LEVELS[this.currentLevelIndex]);
      }
    };

    this.modals.onSelectLevel = (levelId: number) => {
      const idx = LEVELS.findIndex(l => l.id === levelId);
      if (idx >= 0) {
        this.currentLevelIndex = idx;
        this.loadLevel(LEVELS[idx]);
      }
    };
  }

  private loadLevel(level: LevelDefinition) {
    this.currentLevel = level;
    this.currentInventory = { ...level.inventory };
    this.pieces = level.preplacedPieces ? level.preplacedPieces.map(p => ({ ...p })) : [];
    this.selectedPiece = null;
    this.isLevelSolved = false;
    this.solvedTimer = 0;
    this.previousLitTargets.clear();

    this.hud.updateLevelInfo(level);
    this.hud.updateInventory(this.currentInventory);
    this.modals.hideSolved();
  }

  private loadLevelSolution() {
    if (this.currentLevel.id === 70) {
      this.pieces = [
        {
          id: 'sol-prism',
          type: 'prism',
          x: 382,
          y: 382,
          angle: 4.98,
          size: 52
        },
        {
          id: 'sol-green',
          type: 'green',
          x: 600,
          y: 442,
          angle: 0.58,
          size: 66
        },
        {
          id: 'sol-mirror-1',
          type: 'mirror',
          x: 420,
          y: 685,
          angle: 0.40,
          size: 70
        },
        {
          id: 'sol-lens',
          type: 'lens',
          x: 520,
          y: 710,
          angle: 0.35,
          size: 66
        },
        {
          id: 'sol-mirror-2',
          type: 'mirror',
          x: 320,
          y: 620,
          angle: 0.35,
          size: 70
        }
      ];

      // Set inventory to 0 for all pieces used
      this.currentInventory = {
        prism: 0,
        green: 0,
        lens: 0,
        mirror: 0
      };
      this.selectedPiece = null;
      this.hud.updateInventory(this.currentInventory);
      sounds.playPlacePiece();
    }
  }

  private setupEventListeners() {
    window.addEventListener('resize', () => {
      this.setupCanvasDPI();
    });

    const arena = document.getElementById('arena-container')!;

    // Mouse move tracking
    arena.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = 900 / rect.width;
      const scaleY = 900 / rect.height;
      this.mousePos = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };

      // Custom Hand Cursor follow
      this.customCursor.style.left = `${e.clientX - rect.left}px`;
      this.customCursor.style.top = `${e.clientY - rect.top}px`;

      this.handlePointerMove(this.mousePos);
    });

    arena.addEventListener('mouseenter', () => {
      this.customCursor.style.display = 'block';
    });

    arena.addEventListener('mouseleave', () => {
      this.customCursor.style.display = 'none';
      this.handlePointerUp();
    });

    arena.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        // Right click removes selected piece
        e.preventDefault();
        this.removeSelectedPiece();
        return;
      }
      this.handlePointerDown(this.mousePos);
    });

    window.addEventListener('mouseup', () => {
      this.handlePointerUp();
    });

    // Prevent context menu on arena
    arena.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch support
    arena.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 900 / rect.width;
        const scaleY = 900 / rect.height;
        this.mousePos = {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY
        };
        this.handlePointerMove(this.mousePos);
      }
      e.preventDefault();
    }, { passive: false });

    arena.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 900 / rect.width;
        const scaleY = 900 / rect.height;
        this.mousePos = {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY
        };
        this.handlePointerDown(this.mousePos);
      }
      e.preventDefault();
    }, { passive: false });

    arena.addEventListener('touchend', () => {
      this.handlePointerUp();
    });

    // Keyboard shortcuts: Delete/Backspace to remove, R to restart, arrows/wheel to rotate
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        this.removeSelectedPiece();
      } else if (e.key === 'r' || e.key === 'R') {
        this.loadLevel(this.currentLevel);
      } else if (this.selectedPiece && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const delta = e.key === 'ArrowLeft' ? -0.05 : 0.05;
        this.selectedPiece.angle += delta;
        const deg = Math.round((this.selectedPiece.angle * 180) / Math.PI);
        sounds.playRotateTick(deg);
      }
    });

    // Wheel to rotate selected piece
    arena.addEventListener('wheel', (e) => {
      if (this.selectedPiece) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.05 : -0.05;
        this.selectedPiece.angle += delta;
        const deg = Math.round((this.selectedPiece.angle * 180) / Math.PI);
        sounds.playRotateTick(deg);
      }
    }, { passive: false });
  }

  private handlePointerDown(pos: Point) {
    // 1. Check if clicking on selected piece's rotation handle
    if (this.selectedPiece) {
      if (this.gizmoRenderer.isOverHandle(this.selectedPiece, pos.x, pos.y) ||
          this.gizmoRenderer.isOverProtractor(this.selectedPiece, pos.x, pos.y)) {
        this.isRotatingPiece = true;
        this.customCursor.classList.add('grabbing');
        return;
      }
    }

    // 2. Check if clicking on an existing piece in the board
    const clickedPiece = this.findPieceAt(pos.x, pos.y);
    if (clickedPiece) {
      this.selectedPiece = clickedPiece;
      this.isDraggingPiece = true;
      this.dragOffset = {
        x: clickedPiece.x - pos.x,
        y: clickedPiece.y - pos.y
      };
      this.customCursor.classList.add('grabbing');
      sounds.playPlacePiece();
      return;
    }

    // 3. If a tool slot is active in toolbar, place new piece
    const selectedSlotType = this.hud.getSelectedType();
    if (selectedSlotType && this.currentInventory[selectedSlotType] > 0) {
      // Place piece inside arena bounds
      const clampedX = Math.max(70, Math.min(830, pos.x));
      const clampedY = Math.max(70, Math.min(830, pos.y));

      const newPiece: OpticalPiece = {
        id: `piece-${Date.now()}-${Math.random()}`,
        type: selectedSlotType,
        x: clampedX,
        y: clampedY,
        angle: this.getDefaultAngleFor(selectedSlotType),
        size: selectedSlotType === 'prism' ? 52 : selectedSlotType === 'mirror' ? 70 : 66
      };

      this.pieces.push(newPiece);
      this.currentInventory[selectedSlotType]--;
      this.hud.updateInventory(this.currentInventory);
      this.selectedPiece = newPiece;

      sounds.playPlacePiece();
      return;
    }

    // Clicked empty area: deselect
    this.selectedPiece = null;
  }

  private getDefaultAngleFor(type: OpticalItemType): number {
    switch (type) {
      case 'prism': return 4.98; // ~285 deg (ideal initial angle for level 70)
      case 'mirror': return 0.35; // ~20 deg
      case 'green': return 0.58; // ~33 deg
      case 'lens': return 0.35;   // ~20 deg
      default: return 0;
    }
  }

  private handlePointerMove(pos: Point) {
    if (this.isRotatingPiece && this.selectedPiece) {
      const prevDeg = Math.round((this.selectedPiece.angle * 180) / Math.PI);
      const angle = Math.atan2(pos.y - this.selectedPiece.y, pos.x - this.selectedPiece.x);
      this.selectedPiece.angle = angle;
      const curDeg = Math.round((this.selectedPiece.angle * 180) / Math.PI);

      if (Math.abs(curDeg - prevDeg) >= 3) {
        sounds.playRotateTick(curDeg);
      }
    } else if (this.isDraggingPiece && this.selectedPiece) {
      this.selectedPiece.x = Math.max(60, Math.min(840, pos.x + this.dragOffset.x));
      this.selectedPiece.y = Math.max(60, Math.min(840, pos.y + this.dragOffset.y));
    }
  }

  private handlePointerUp() {
    this.isDraggingPiece = false;
    this.isRotatingPiece = false;
    this.customCursor.classList.remove('grabbing');
  }

  private findPieceAt(x: number, y: number): OpticalPiece | null {
    // Reverse search so topmost piece is picked first
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      if (dist({ x, y }, p) <= 40) {
        return p;
      }
    }
    return null;
  }

  private removeSelectedPiece() {
    if (!this.selectedPiece) return;
    const piece = this.selectedPiece;
    const idx = this.pieces.indexOf(piece);
    if (idx >= 0) {
      this.pieces.splice(idx, 1);
      // Return piece to inventory
      this.currentInventory[piece.type]++;
      this.hud.updateInventory(this.currentInventory);
      this.selectedPiece = null;
      sounds.playPlacePiece();
    }
  }

  private gameLoop(time: number) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    // Measure FPS
    if (dt > 0) {
      this.fps = this.fps * 0.9 + (1 / dt) * 0.1;
      this.hud.updateFPS(this.fps);
    }

    // 1. Simulate Light Physics
    const { rays, litTargets } = this.physicsEngine.simulate(
      this.currentLevel.emitter,
      this.pieces,
      this.currentLevel.blackHoles,
      this.currentLevel.walls,
      this.currentLevel.targets
    );

    // Audio feedback for targets newly lit
    for (const target of this.currentLevel.targets) {
      if (litTargets.has(target.id) && !this.previousLitTargets.has(target.id)) {
        sounds.playTargetHit(target.colorType);
      }
    }
    this.previousLitTargets = litTargets;

    // 2. Clear & Render Board Background, Walls, Black Holes, Emitters, Targets
    this.boardRenderer.render(
      this.ctx,
      900,
      900,
      this.currentLevel.emitter,
      this.currentLevel.targets,
      this.currentLevel.blackHoles,
      this.currentLevel.walls,
      dt
    );

    // 3. Render Volumetric Light Beams and Optical Pieces
    this.lightRenderer.renderLightBeams(this.ctx, rays);
    this.lightRenderer.renderPieces(this.ctx, this.pieces);

    // 4. Render Protractor Gizmo for Selected Piece
    if (this.selectedPiece) {
      this.gizmoRenderer.renderProtractor(this.ctx, this.selectedPiece, this.mousePos);
    }

    // 5. Victory Check
    const allLit = this.currentLevel.targets.length > 0 &&
      this.currentLevel.targets.every(t => litTargets.has(t.id));

    if (allLit && !this.isLevelSolved && this.currentLevel.id !== 999) {
      this.solvedTimer += dt;
      if (this.solvedTimer > 0.7) {
        this.isLevelSolved = true;
        sounds.playVictoryChime();
        this.modals.showSolved(this.pieces.length, this.currentLevel.par, this.currentLevel.id);
      }
    } else if (!allLit) {
      this.solvedTimer = 0;
    }

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

// Start Game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
