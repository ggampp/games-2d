/**
 * The Long Spectrum - Main Application Entry Point
 * Initializes DOM elements, binds UI controls, manages modals and inventory drag events.
 */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');

    // UI Elements map
    const ui = {
        levelNumber: document.getElementById('levelNumber'),
        levelTitle: document.getElementById('levelTitle'),
        parCounter: document.getElementById('parCounter'),
        hintText: document.getElementById('hintText'),
        mirrorCard: document.getElementById('mirrorCard'),
        mirrorBadge: document.getElementById('mirrorBadge'),
        prismCard: document.getElementById('prismCard'),
        prismBadge: document.getElementById('prismBadge'),
        soundBtn: document.getElementById('soundBtn'),
        resetBtn: document.getElementById('resetBtn'),
        hintBtn: document.getElementById('hintBtn'),
        levelsBtn: document.getElementById('levelsBtn'),
        victoryModal: document.getElementById('victoryModal'),
        victoryStats: document.getElementById('victoryStats'),
        nextLevelBtn: document.getElementById('nextLevelBtn'),
        freePlayBtn: document.getElementById('freePlayBtn'),
        victoryLevelsBtn: document.getElementById('victoryLevelsBtn'),
        levelsModal: document.getElementById('levelsModal'),
        closeLevelsModal: document.getElementById('closeLevelsModal'),
        levelsGrid: document.getElementById('levelsGrid'),
        hintModal: document.getElementById('hintModal'),
        hintModalText: document.getElementById('hintModalText'),
        closeHintModal: document.getElementById('closeHintModal')
    };

    // Instantiate game engine
    const game = new GameEngine(canvas, ui);
    window.game = game;

    // 1. Header Buttons
    ui.resetBtn.addEventListener('click', () => {
        game.sound.playButtonClick();
        game.resetCurrentLevel();
    });

    ui.soundBtn.addEventListener('click', () => {
        const isMuted = game.sound.toggleMute();
        game.sound.playButtonClick();
        ui.soundBtn.textContent = isMuted ? "SOUND: OFF" : "SOUND";
        ui.soundBtn.classList.toggle('muted', isMuted);
    });

    ui.hintBtn.addEventListener('click', () => {
        game.sound.playButtonClick();
        ui.hintModalText.textContent = game.level.hint || "Try rearranging the mirrors and prisms to guide the light beam to the colored targets.";
        ui.hintModal.classList.remove('hidden');
    });

    ui.closeHintModal.addEventListener('click', () => {
        game.sound.playButtonClick();
        ui.hintModal.classList.add('hidden');
    });

    ui.levelsBtn.addEventListener('click', () => {
        game.sound.playButtonClick();
        populateLevelsGrid();
        ui.levelsModal.classList.remove('hidden');
    });

    ui.closeLevelsModal.addEventListener('click', () => {
        game.sound.playButtonClick();
        ui.levelsModal.classList.add('hidden');
    });

    // 2. Victory Modal Buttons
    ui.nextLevelBtn.addEventListener('click', () => {
        game.sound.playButtonClick();
        game.nextLevel();
    });

    ui.freePlayBtn.addEventListener('click', () => {
        game.sound.playButtonClick();
        if (ui.victoryModal) ui.victoryModal.classList.add('hidden');
        game.loadFreePlay();
    });

    if (ui.victoryLevelsBtn) {
        ui.victoryLevelsBtn.addEventListener('click', () => {
            game.sound.playButtonClick();
            if (ui.victoryModal) ui.victoryModal.classList.add('hidden');
            populateLevelsGrid();
            ui.levelsModal.classList.remove('hidden');
        });
    }

    // 3. Inventory Dock Interaction (Click or Drag onto Canvas)
    ui.mirrorCard.addEventListener('mousedown', (e) => {
        if (game.availableInventory.mirrors <= 0) return;
        game.sound.resume();
        game.dragFromInventoryType = 'mirror';
    });

    ui.prismCard.addEventListener('mousedown', (e) => {
        if (game.availableInventory.prisms <= 0) return;
        game.sound.resume();
        game.dragFromInventoryType = 'prism';
    });

    // Mobile touch on cards
    ui.mirrorCard.addEventListener('touchstart', (e) => {
        if (game.availableInventory.mirrors <= 0) return;
        game.sound.resume();
        game.dragFromInventoryType = 'mirror';
    }, { passive: true });

    ui.prismCard.addEventListener('touchstart', (e) => {
        if (game.availableInventory.prisms <= 0) return;
        game.sound.resume();
        game.dragFromInventoryType = 'prism';
    }, { passive: true });

    // Also support direct click to drop at center of screen if not dragging
    ui.mirrorCard.addEventListener('click', (e) => {
        if (game.availableInventory.mirrors > 0 && !game.isDragging) {
            const newMirror = {
                type: 'mirror',
                x: 500 + (Math.random() - 0.5) * 80,
                y: 500 + (Math.random() - 0.5) * 80,
                rotation: Math.PI / 4,
                length: 85
            };
            game.placedMirrors.push(newMirror);
            game.availableInventory.mirrors--;
            game.selectedElement = newMirror;
            game.sound.playPlace();
            game.updateUI();
        }
    });

    ui.prismCard.addEventListener('click', (e) => {
        if (game.availableInventory.prisms > 0 && !game.isDragging) {
            const newPrism = {
                type: 'prism',
                x: 500 + (Math.random() - 0.5) * 80,
                y: 500 + (Math.random() - 0.5) * 80,
                rotation: 0,
                size: 76
            };
            game.placedPrisms.push(newPrism);
            game.availableInventory.prisms--;
            game.selectedElement = newPrism;
            game.sound.playPlace();
            game.updateUI();
        }
    });

    // 4. Level Select Grid Population
    function populateLevelsGrid() {
        ui.levelsGrid.innerHTML = '';

        LEVELS.forEach((lvl, idx) => {
            const btn = document.createElement('button');
            btn.className = 'level-card-btn';
            if (idx === game.currentLevelIndex && !game.isFreePlay) {
                btn.classList.add('current');
            }
            if (game.completedLevels.has(lvl.id)) {
                btn.classList.add('completed');
            }

            btn.innerHTML = `
                <span class="lvl-num">${lvl.id}</span>
                <span class="lvl-name">${lvl.title}</span>
            `;

            btn.addEventListener('click', () => {
                game.sound.playButtonClick();
                game.loadLevel(idx);
                ui.levelsModal.classList.add('hidden');
            });

            ui.levelsGrid.appendChild(btn);
        });

        // Add Sandbox / Free Play tile
        const sandboxBtn = document.createElement('button');
        sandboxBtn.className = 'level-card-btn sandbox';
        if (game.isFreePlay) sandboxBtn.classList.add('current');
        sandboxBtn.innerHTML = `
            <span class="lvl-num">∞</span>
            <span class="lvl-name">FREE PLAY</span>
        `;
        sandboxBtn.addEventListener('click', () => {
            game.sound.playButtonClick();
            game.loadFreePlay();
            ui.levelsModal.classList.add('hidden');
        });
        ui.levelsGrid.appendChild(sandboxBtn);
    }

    // Close modals on clicking backdrop
    window.addEventListener('click', (e) => {
        if (e.target === ui.levelsModal) {
            ui.levelsModal.classList.add('hidden');
        }
        if (e.target === ui.hintModal) {
            ui.hintModal.classList.add('hidden');
        }
    });

    // Auto-resume audio on first user gesture anywhere
    window.addEventListener('pointerdown', () => {
        game.sound.resume();
    }, { once: true });
});
