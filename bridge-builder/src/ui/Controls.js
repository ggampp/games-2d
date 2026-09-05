import { Vector2 } from '../physics/Vector2.js';
import { MATERIALS } from '../physics/Material.js';

export class Controls {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;

    this.isDragging = false;
    this.dragStartNode = null;
    this.currentMousePos = new Vector2(0, 0);

    this.hoveredNode = null;
    this.hoveredBeam = null;
    this.deleteMode = false;

    this.bindEvents();
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return new Vector2(
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY
    );
  }

  snapToGrid(pos, gridSize = 25) {
    return new Vector2(
      Math.round(pos.x / gridSize) * gridSize,
      Math.round(pos.y / gridSize) * gridSize
    );
  }

  bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));

    // Touch support for mobile/tablets
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.onMouseDown(e.touches[0]);
      }
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.onMouseMove(e.touches[0]);
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      this.onMouseUp(e);
    });
  }

  onMouseDown(e) {
    if (this.game.mode !== 'BUILD') return;
    const pos = this.getCanvasCoords(e);

    // Left click
    if (e.button === 0 || e.button === undefined) {
      if (this.deleteMode) {
        const beam = this.game.bridge.findBeamNear(pos.x, pos.y, 18);
        if (beam) {
          this.game.bridge.removeBeam(beam);
          this.game.sound.playClick();
          this.game.updateBudgetUI();
          return;
        }
        const node = this.game.bridge.findNodeNear(pos.x, pos.y, 16);
        if (node && !node.isAnchor) {
          this.game.bridge.removeNode(node);
          this.game.sound.playClick();
          this.game.updateBudgetUI();
          return;
        }
      }

      // Start beam placement from a node
      let startNode = this.game.bridge.findNodeNear(pos.x, pos.y, 22);
      if (!startNode) {
        // If clicking on grid near road height, allow creating a node
        const snapped = this.snapToGrid(pos);
        if (pos.x >= this.game.bridge.leftCliff.endX - 10 && pos.x <= this.game.bridge.rightCliff.startX + 10) {
          startNode = this.game.bridge.addNode(snapped.x, snapped.y, false, this.game.activeMaterialKey === 'ROAD');
          this.game.sound.playClick();
        }
      }

      if (startNode) {
        this.isDragging = true;
        this.dragStartNode = startNode;
        this.currentMousePos.copy(pos);
      }
    }
  }

  onMouseMove(e) {
    const pos = this.getCanvasCoords(e);
    this.currentMousePos.copy(pos);

    if (this.game.mode === 'BUILD') {
      this.hoveredNode = this.game.bridge.findNodeNear(pos.x, pos.y, 16);
      this.hoveredBeam = this.game.bridge.findBeamNear(pos.x, pos.y, 12);

      if (this.isDragging && this.dragStartNode) {
        // Target can snap to existing node or to grid
        let targetPos = pos;
        const targetNode = this.game.bridge.findNodeNear(pos.x, pos.y, 20);
        if (targetNode && targetNode !== this.dragStartNode) {
          targetPos = targetNode.pos;
        } else {
          targetPos = this.snapToGrid(pos);
        }

        const dist = this.dragStartNode.pos.distanceTo(targetPos);
        const mat = MATERIALS[this.game.activeMaterialKey] || MATERIALS.WOOD;
        const isValid = dist <= mat.maxLength && dist >= 20;

        this.game.previewBeam = {
          startNode: this.dragStartNode,
          currentPos: targetPos,
          length: dist,
          isValid
        };
      } else {
        this.game.previewBeam = null;
      }
    }
  }

  onMouseUp(e) {
    if (!this.isDragging || this.game.mode !== 'BUILD') {
      this.isDragging = false;
      this.dragStartNode = null;
      this.game.previewBeam = null;
      return;
    }

    const pos = this.getCanvasCoords(e);
    const mat = MATERIALS[this.game.activeMaterialKey] || MATERIALS.WOOD;

    // Find destination node or snap to grid
    let endNode = this.game.bridge.findNodeNear(pos.x, pos.y, 20);

    if (!endNode) {
      const snapped = this.snapToGrid(pos);
      // Ensure within canyon bounds
      if (snapped.x > 80 && snapped.x < 880 && snapped.y > 180 && snapped.y < 500) {
        const dist = this.dragStartNode.pos.distanceTo(snapped);
        if (dist <= mat.maxLength && dist >= 20) {
          endNode = this.game.bridge.addNode(snapped.x, snapped.y, false, mat.isRoad);
        }
      }
    }

    if (endNode && endNode !== this.dragStartNode) {
      const dist = this.dragStartNode.pos.distanceTo(endNode.pos);
      if (dist <= mat.maxLength) {
        const beam = this.game.bridge.addBeam(this.dragStartNode, endNode, this.game.activeMaterialKey);
        if (beam) {
          this.game.sound.playConnect(mat.isRoad);
          this.game.updateBudgetUI();
        }
      }
    }

    this.isDragging = false;
    this.dragStartNode = null;
    this.game.previewBeam = null;
  }

  onContextMenu(e) {
    e.preventDefault();
    if (this.game.mode !== 'BUILD') return;
    const pos = this.getCanvasCoords(e);

    const beam = this.game.bridge.findBeamNear(pos.x, pos.y, 16);
    if (beam) {
      this.game.bridge.removeBeam(beam);
      this.game.sound.playClick();
      this.game.updateBudgetUI();
      return;
    }

    const node = this.game.bridge.findNodeNear(pos.x, pos.y, 16);
    if (node && !node.isAnchor) {
      this.game.bridge.removeNode(node);
      this.game.sound.playClick();
      this.game.updateBudgetUI();
    }
  }
}
