/**
 * The Long Spectrum - Main Game Engine
 * Manages game state, user interactions (drag, drop, rotate), inventory counts,
 * win detection, level transitions, and UI synchronizations.
 */

class GameEngine {
    constructor(canvas, uiElements) {
        this.canvas = canvas;
        this.ui = uiElements;
        this.renderer = new GameRenderer(canvas);
        this.sound = new SoundEngine();

        this.currentLevelIndex = 12; // Start on Level 13 (index 12) as featured in prototype!
        this.isFreePlay = false;
        this.level = LEVELS[this.currentLevelIndex];

        // Placed optical elements
        this.placedMirrors = [];
        this.placedPrisms = [];
        this.availableInventory = { mirrors: 4, prisms: 1 };

        // Interaction state
        this.selectedElement = null;
        this.hoveredElement = null;
        this.isDragging = false;
        this.isRotating = false;
        this.dragOffset = { x: 0, y: 0 };
        this.dragFromInventoryType = null; // 'mirror' or 'prism'

        // Rotation tracking
        this.lastRotateAngleDeg = 0;

        // Victory state
        this.isSolved = false;
        this.solveTimer = 0;
        this.completedLevels = new Set();

        // Game loop
        this.lastTime = performance.now();
        this.isRunning = true;

        this.initCanvasSize();
        this.bindEvents();
        this.loadLevel(this.currentLevelIndex);
        this.startLoop();
    }

    initCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = 1000 * dpr;
        this.canvas.height = 1000 * dpr;
        this.renderer.dpr = dpr;
    }

    loadLevel(index) {
        this.isFreePlay = false;
        this.currentLevelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
        this.level = LEVELS[this.currentLevelIndex];

        this.placedMirrors = [];
        this.placedPrisms = [];
        this.availableInventory = { ...this.level.inventory };
        this.selectedElement = null;
        this.isSolved = false;
        this.solveTimer = 0;

        this.sound.stopAllTargetSounds();
        this.updateUI();
    }

    loadFreePlay() {
        this.isFreePlay = true;
        this.level = FREE_PLAY_CONFIG;
        this.placedMirrors = [];
        this.placedPrisms = [];
        this.availableInventory = { mirrors: 99, prisms: 99 };
        this.selectedElement = null;
        this.isSolved = false;
        this.solveTimer = 0;

        this.sound.stopAllTargetSounds();
        this.updateUI();
    }

    resetCurrentLevel() {
        this.sound.playReset();
        this.placedMirrors = [];
        this.placedPrisms = [];
        this.availableInventory = this.isFreePlay ? { mirrors: 99, prisms: 99 } : { ...this.level.inventory };
        this.selectedElement = null;
        this.isSolved = false;
        this.solveTimer = 0;
        this.sound.stopAllTargetSounds();
        this.updateUI();
    }

    // Convert mouse/touch event to 1000x1000 canvas virtual coordinates
    getVirtualCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const scaleX = 1000 / rect.width;
        const scaleY = 1000 / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    // Find element under virtual cursor
    findElementAt(pos) {
        // 1. Check if clicking on rotation handle knob of selected element
        if (this.selectedElement) {
            const rot = this.selectedElement.rotation;
            const handleX = this.selectedElement.x + Math.cos(rot) * 62;
            const handleY = this.selectedElement.y + Math.sin(rot) * 62;
            const distToKnob = Math.hypot(pos.x - handleX, pos.y - handleY);
            if (distToKnob <= 18) {
                return { element: this.selectedElement, isRotationHandle: true };
            }
        }

        // 2. Check prisms
        for (let i = this.placedPrisms.length - 1; i >= 0; i--) {
            const prism = this.placedPrisms[i];
            const dist = Math.hypot(pos.x - prism.x, pos.y - prism.y);
            if (dist <= 40) {
                return { element: prism, isRotationHandle: false };
            }
        }

        // 3. Check mirrors
        for (let i = this.placedMirrors.length - 1; i >= 0; i--) {
            const mirror = this.placedMirrors[i];
            const seg = this.renderer.optics.getMirrorSegment(
                new Vector2(mirror.x, mirror.y),
                mirror.length || 85,
                mirror.rotation
            );
            const dist = distToSegment(new Vector2(pos.x, pos.y), seg.p1, seg.p2);
            if (dist <= 18) {
                return { element: mirror, isRotationHandle: false };
            }
        }

        return null;
    }

    deleteElement(element) {
        if (!element) return;
        if (element.type === 'mirror') {
            const idx = this.placedMirrors.indexOf(element);
            if (idx !== -1) {
                this.placedMirrors.splice(idx, 1);
                this.availableInventory.mirrors++;
            }
        } else if (element.type === 'prism') {
            const idx = this.placedPrisms.indexOf(element);
            if (idx !== -1) {
                this.placedPrisms.splice(idx, 1);
                this.availableInventory.prisms++;
            }
        }
        if (this.selectedElement === element) {
            this.selectedElement = null;
        }
        this.sound.playPlace();
        this.updateUI();
    }

    bindEvents() {
        const c = this.canvas;

        // Pointer down
        const handlePointerDown = (pos, e) => {
            this.sound.resume();

            // Check if dragging from inventory dock item
            if (this.dragFromInventoryType) {
                const type = this.dragFromInventoryType;
                if (type === 'mirror' && this.availableInventory.mirrors > 0) {
                    const newMirror = {
                        type: 'mirror',
                        x: Math.max(50, Math.min(950, pos.x)),
                        y: Math.max(50, Math.min(950, pos.y)),
                        rotation: Math.PI / 4, // 45 deg default
                        length: 85
                    };
                    this.placedMirrors.push(newMirror);
                    this.availableInventory.mirrors--;
                    this.selectedElement = newMirror;
                    this.isDragging = true;
                    this.dragOffset = { x: 0, y: 0 };
                    this.sound.playPickup();
                } else if (type === 'prism' && this.availableInventory.prisms > 0) {
                    const newPrism = {
                        type: 'prism',
                        x: Math.max(50, Math.min(950, pos.x)),
                        y: Math.max(50, Math.min(950, pos.y)),
                        rotation: 0,
                        size: 76
                    };
                    this.placedPrisms.push(newPrism);
                    this.availableInventory.prisms--;
                    this.selectedElement = newPrism;
                    this.isDragging = true;
                    this.dragOffset = { x: 0, y: 0 };
                    this.sound.playPickup();
                }
                this.dragFromInventoryType = null;
                this.updateUI();
                return;
            }

            const hit = this.findElementAt(pos);
            if (hit) {
                if (hit.isRotationHandle) {
                    this.isRotating = true;
                    this.lastRotateAngleDeg = Math.round(this.selectedElement.rotation * 180 / Math.PI);
                } else {
                    this.selectedElement = hit.element;
                    this.isDragging = true;
                    this.dragOffset = {
                        x: pos.x - hit.element.x,
                        y: pos.y - hit.element.y
                    };
                    this.sound.playPickup();
                }
            } else {
                // Click on empty space: deselect
                this.selectedElement = null;
            }
            this.updateUI();
        };

        // Pointer move
        const handlePointerMove = (pos) => {
            if (this.isRotating && this.selectedElement) {
                const dx = pos.x - this.selectedElement.x;
                const dy = pos.y - this.selectedElement.y;
                let angle = Math.atan2(dy, dx);
                if (angle < 0) angle += Math.PI * 2;
                this.selectedElement.rotation = angle;

                // Audio tick feedback every 5 degrees
                const curDeg = Math.round(angle * 180 / Math.PI);
                if (Math.abs(curDeg - this.lastRotateAngleDeg) >= 6) {
                    this.sound.playRotateTick();
                    this.lastRotateAngleDeg = curDeg;
                }
            } else if (this.isDragging && this.selectedElement) {
                this.selectedElement.x = Math.max(50, Math.min(950, pos.x - this.dragOffset.x));
                this.selectedElement.y = Math.max(50, Math.min(950, pos.y - this.dragOffset.y));
            } else {
                const hit = this.findElementAt(pos);
                this.hoveredElement = hit ? hit.element : null;
                c.style.cursor = hit ? (hit.isRotationHandle ? 'crosshair' : 'grab') : 'default';
            }
        };

        // Pointer up
        const handlePointerUp = () => {
            if (this.isDragging || this.isRotating) {
                this.sound.playPlace();
            }
            this.isDragging = false;
            this.isRotating = false;
            this.dragFromInventoryType = null;
        };

        // Mouse listeners
        c.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                handlePointerDown(this.getVirtualCoords(e), e);
            } else if (e.button === 2) { // Right click: delete element
                const hit = this.findElementAt(this.getVirtualCoords(e));
                if (hit && !hit.isRotationHandle) {
                    this.deleteElement(hit.element);
                }
            }
        });

        c.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('mousemove', (e) => {
            handlePointerMove(this.getVirtualCoords(e));
        });

        window.addEventListener('mouseup', () => {
            handlePointerUp();
        });

        // Touch listeners
        c.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handlePointerDown(this.getVirtualCoords(e), e);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.isDragging || this.isRotating) {
                e.preventDefault();
            }
            handlePointerMove(this.getVirtualCoords(e));
        }, { passive: false });

        window.addEventListener('touchend', () => {
            handlePointerUp();
        });

        // Keyboard shortcuts (Delete / Backspace / R for reset / Escape)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedElement) {
                    this.deleteElement(this.selectedElement);
                }
            } else if (e.key === 'r' || e.key === 'R') {
                this.resetCurrentLevel();
            } else if (e.key === 'Escape') {
                this.selectedElement = null;
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.initCanvasSize();
        });
    }

    // Update UI labels and counters
    updateUI() {
        const totalUsed = this.placedMirrors.length + this.placedPrisms.length;
        const par = this.level.par || 5;

        // Level Title & Header
        if (this.ui.levelNumber) {
            this.ui.levelNumber.textContent = this.isFreePlay ? "SANDBOX" : `LEVEL ${this.level.id}`;
        }
        if (this.ui.levelTitle) {
            this.ui.levelTitle.textContent = this.level.title;
        }

        // Par Counter
        if (this.ui.parCounter) {
            this.ui.parCounter.textContent = `USED ${totalUsed} · PAR ${par}`;
        }

        // Hint bar
        if (this.ui.hintText) {
            this.ui.hintText.textContent = this.level.hint || "";
        }

        // Inventory badge counts
        if (this.ui.mirrorBadge) {
            this.ui.mirrorBadge.textContent = this.availableInventory.mirrors;
            this.ui.mirrorCard.classList.toggle('disabled', this.availableInventory.mirrors <= 0);
        }
        if (this.ui.prismBadge) {
            this.ui.prismBadge.textContent = this.availableInventory.prisms;
            this.ui.prismCard.classList.toggle('disabled', this.availableInventory.prisms <= 0);
        }

        // Sound button text
        if (this.ui.soundBtn) {
            this.ui.soundBtn.textContent = this.sound.isMuted ? "SOUND: OFF" : "SOUND";
        }
    }

    // Main animation & simulation tick
    startLoop() {
        const loop = (time) => {
            if (!this.isRunning) return;
            const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
            this.lastTime = time;

            // Render and simulate
            const simResult = this.renderer.render({
                emitters: this.level.emitters,
                placedMirrors: this.placedMirrors,
                placedPrisms: this.placedPrisms,
                walls: this.level.walls,
                targets: this.level.targets,
                selectedElement: this.selectedElement,
                hoveredElement: this.hoveredElement
            }, deltaTime);

            // Update Target Audio Resonances
            this.sound.updateTargetSounds(simResult.targetResults);

            // Check Win Condition
            const allTargetsActive = simResult.targetResults.length > 0 &&
                simResult.targetResults.every(res => res.active);

            if (allTargetsActive && !this.isSolved && !this.isFreePlay) {
                this.solveTimer += deltaTime;
                if (this.solveTimer >= 0.3) {
                    this.onLevelSolved();
                }
            } else if (!allTargetsActive && !this.isSolved) {
                this.solveTimer = 0;
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    onLevelSolved() {
        this.isSolved = true;
        this.completedLevels.add(this.level.id);

        // Spawn celebration fireworks
        this.renderer.spawnVictoryParticles(this.level.targets);
        this.sound.playVictory();

        const totalUsed = this.placedMirrors.length + this.placedPrisms.length;
        const par = this.level.par || 5;

        // Show victory modal
        setTimeout(() => {
            if (this.ui.victoryModal) {
                if (this.ui.victoryStats) {
                    this.ui.victoryStats.textContent = `${totalUsed} PIECES USED · PAR ${par}`;
                }
                this.ui.victoryModal.classList.remove('hidden');
            }
        }, 600);
    }

    nextLevel() {
        if (this.ui.victoryModal) {
            this.ui.victoryModal.classList.add('hidden');
        }
        if (this.currentLevelIndex < LEVELS.length - 1) {
            this.loadLevel(this.currentLevelIndex + 1);
        } else {
            // Mastered all levels, go to Free Play
            this.loadFreePlay();
        }
    }
}

window.GameEngine = GameEngine;
