import { MATERIALS } from '../physics/Material.js';

export const PRESETS = {
  WARREN_TRUSS: {
    id: 'WARREN_TRUSS',
    name: 'Modelo A: Treliça Warren (Deck Truss)',
    tag: 'A',
    description: 'Vigas paralelas de topo e base com diagonais triangulares alternadas. Distribuição de carga uniforme e alta rigidez estrutural contra deflexão.',
    build: (bridge) => {
      bridge.clear();

      const startX = 180;
      const endX = 740;
      const deckY = 260;
      const bottomY = 335;
      const segments = 8;
      const step = (endX - startX) / segments; // 70px

      // 1. Deck road nodes
      const deckNodes = [];
      for (let i = 0; i <= segments; i++) {
        const x = startX + i * step;
        const isAnchor = (i === 0 || i === segments);
        let node;
        if (isAnchor) {
          node = bridge.findNodeNear(x, deckY, 15);
        } else {
          node = bridge.addNode(x, deckY, false, true);
        }
        deckNodes.push(node);
      }

      // Connect road deck
      for (let i = 0; i < deckNodes.length - 1; i++) {
        bridge.addBeam(deckNodes[i], deckNodes[i + 1], 'ROAD');
      }

      // 2. Bottom chord nodes
      const bottomNodes = [];
      for (let i = 0; i <= segments; i++) {
        const x = startX + i * step;
        const isAnchor = (i === 0 || i === segments);
        let node;
        if (isAnchor) {
          node = bridge.findNodeNear(x, bottomY, 15);
        } else {
          node = bridge.addNode(x, bottomY, false, false);
        }
        bottomNodes.push(node);
      }

      // Connect bottom chord with steel
      for (let i = 0; i < bottomNodes.length - 1; i++) {
        bridge.addBeam(bottomNodes[i], bottomNodes[i + 1], 'STEEL');
      }

      // 3. Vertical and diagonal truss webbing (alternating Warren pattern)
      for (let i = 0; i < segments; i++) {
        // Vertical strut
        bridge.addBeam(deckNodes[i], bottomNodes[i], 'STEEL');

        // Diagonal
        if (i % 2 === 0) {
          bridge.addBeam(deckNodes[i], bottomNodes[i + 1], 'STEEL');
        } else {
          bridge.addBeam(bottomNodes[i], deckNodes[i + 1], 'STEEL');
        }
      }
      // Last vertical
      bridge.addBeam(deckNodes[segments], bottomNodes[segments], 'STEEL');
    }
  },

  FAN_STRUT: {
    id: 'FAN_STRUT',
    name: 'Modelo B: Escora em Leque (Inverted King-Post)',
    tag: 'B',
    description: 'Nó central profundo formando um grande V invertido. Vigas e tirantes em leque sustentam os pontos centrais da pista sob forte tração.',
    build: (bridge) => {
      bridge.clear();

      const startX = 180;
      const endX = 740;
      const deckY = 260;
      const segments = 8;
      const step = (endX - startX) / segments; // 70px

      // Deck road nodes
      const deckNodes = [];
      for (let i = 0; i <= segments; i++) {
        const x = startX + i * step;
        const isAnchor = (i === 0 || i === segments);
        let node;
        if (isAnchor) {
          node = bridge.findNodeNear(x, deckY, 15);
        } else {
          node = bridge.addNode(x, deckY, false, true);
        }
        deckNodes.push(node);
      }

      // Connect road deck
      for (let i = 0; i < deckNodes.length - 1; i++) {
        bridge.addBeam(deckNodes[i], deckNodes[i + 1], 'ROAD');
      }

      // Lower central king-post apex node
      const centerX = 460;
      const apexY = 415;
      const apexNode = bridge.addNode(centerX, apexY, false, false);

      // Deep foundation bottom anchor
      const gorgeAnchor = bridge.findNodeNear(460, 480, 20);
      if (gorgeAnchor) {
        bridge.addBeam(apexNode, gorgeAnchor, 'CONCRETE');
      }

      // Major diagonal compressive struts from cliff abutments to apex
      const leftMidAnchor = bridge.findNodeNear(180, 335, 20);
      const rightMidAnchor = bridge.findNodeNear(740, 335, 20);

      if (leftMidAnchor) bridge.addBeam(leftMidAnchor, apexNode, 'STEEL');
      if (rightMidAnchor) bridge.addBeam(rightMidAnchor, apexNode, 'STEEL');

      // Radiating fan struts from the central apex to all deck nodes!
      for (let i = 1; i < segments; i++) {
        const mat = (i === 4) ? 'STEEL' : 'STEEL';
        bridge.addBeam(apexNode, deckNodes[i], mat);
      }

      // Additional secondary diagonals for lateral deck stabilization
      bridge.addBeam(deckNodes[0], deckNodes[2], 'WOOD');
      bridge.addBeam(deckNodes[segments], deckNodes[segments - 2], 'WOOD');
    }
  },

  ARCH_BRIDGE: {
    id: 'ARCH_BRIDGE',
    name: 'Modelo C: Ponte em Arco com Pilares (Deck Arch)',
    tag: 'C',
    description: 'Arco parabólico que transfere as forças de compressão para os pilares rochosos das encostas, com colunas verticais conectando o arco ao tabuleiro.',
    build: (bridge) => {
      bridge.clear();

      const startX = 180;
      const endX = 740;
      const deckY = 260;
      const segments = 8;
      const step = (endX - startX) / segments; // 70px

      // Deck road nodes
      const deckNodes = [];
      for (let i = 0; i <= segments; i++) {
        const x = startX + i * step;
        const isAnchor = (i === 0 || i === segments);
        let node;
        if (isAnchor) {
          node = bridge.findNodeNear(x, deckY, 15);
        } else {
          node = bridge.addNode(x, deckY, false, true);
        }
        deckNodes.push(node);
      }

      // Connect road deck
      for (let i = 0; i < deckNodes.length - 1; i++) {
        bridge.addBeam(deckNodes[i], deckNodes[i + 1], 'ROAD');
      }

      // Parabolic arch nodes
      // Parabola equation: y = apexY + k * (x - centerX)^2
      const centerX = 460;
      const archApexY = 320;
      const archBaseY = 445;
      const halfSpan = (endX - startX) / 2; // 280
      const k = (archBaseY - archApexY) / (halfSpan * halfSpan);

      const archNodes = [];
      for (let i = 0; i <= segments; i++) {
        const x = startX + i * step;
        const y = archApexY + k * Math.pow(x - centerX, 2);

        let node;
        if (i === 0) {
          // Snap to left lower cliff anchor
          node = bridge.findNodeNear(125, 410, 50) || bridge.addNode(x, y, true, false);
        } else if (i === segments) {
          // Snap to right lower cliff anchor
          node = bridge.findNodeNear(795, 410, 50) || bridge.addNode(x, y, true, false);
        } else {
          node = bridge.addNode(x, y, false, false);
        }
        archNodes.push(node);
      }

      // Connect arch members with Concrete / Rigid Steel
      for (let i = 0; i < archNodes.length - 1; i++) {
        bridge.addBeam(archNodes[i], archNodes[i + 1], 'CONCRETE');
      }

      // Vertical spandrel columns connecting arch nodes to road deck nodes
      for (let i = 1; i < segments; i++) {
        bridge.addBeam(deckNodes[i], archNodes[i], 'CONCRETE');

        // Cross bracing for stability between spandrels
        if (i < segments - 1) {
          bridge.addBeam(deckNodes[i], archNodes[i + 1], 'STEEL');
        }
      }

      // Abutment tie-backs
      const leftMid = bridge.findNodeNear(180, 335, 20);
      const rightMid = bridge.findNodeNear(740, 335, 20);
      if (leftMid) bridge.addBeam(leftMid, archNodes[1], 'CONCRETE');
      if (rightMid) bridge.addBeam(rightMid, archNodes[segments - 1], 'CONCRETE');
    }
  },

  EMPTY: {
    id: 'EMPTY',
    name: 'Modo Livre (Construção do Zero)',
    tag: 'Livre',
    description: 'Comece com apenas os pontos de apoio nas rochas e crie seu próprio projeto estrutural personalizado sem limites.',
    build: (bridge) => {
      bridge.clear();
      // Only road deck start & end points
    }
  }
};
