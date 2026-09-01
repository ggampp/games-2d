(() => {
  "use strict";

  // Elements
  const canvas = document.querySelector("#world");
  const ctx = canvas.getContext("2d", { alpha: false });
  const frame = document.querySelector(".frame");
  const form = document.querySelector("#controls");
  const pauseButton = document.querySelector("#pause");
  const pauseLabel = document.querySelector("#pause-label");
  const statusText = document.querySelector("#status-text");
  const statusDot = document.querySelector(".status-dot");
  const elapsed = document.querySelector("#elapsed");
  const fpsDisplay = document.querySelector("#fps-val");
  const dominanceBar = document.querySelector("#dominance-bar");
  const leaderboardList = document.querySelector("#leaderboard-list");
  const soundBtn = document.querySelector("#sound-toggle");
  const diceBtn = document.querySelector("#random-seed-btn");
  const themeToggle = document.querySelector("#theme-toggle");
  const screenshotBtn = document.querySelector("#screenshot-btn");
  const colorChipsContainer = document.querySelector("#color-chips");
  const brushSelectedDesc = document.querySelector("#brush-selected-label");
  const radiusButtons = document.querySelectorAll(".radius-btn");

  const fields = ["players", "ballsPerPlayer", "brick", "speed", "radius", "seed", "paletteSelect"];

  // Paint Brush State
  let selectedBrushOwner = -1; // -1 = Random
  let brushRadius = 2; // Default small (P)
  let isPainting = false;

  // Palettes
  const PALETTES = {
    classic: [
      "#e05b43", "#2459a6", "#e6b82e", "#479967", "#8a64a7",
      "#dd7834", "#299a9b", "#bd4968", "#71843a", "#545c92",
      "#c93f32", "#3874b8", "#d69c22", "#2f7b59", "#a75183",
      "#c5673d", "#397f89", "#d06177", "#8d8731", "#65519a",
      "#a94f27", "#4f8a70", "#9c3f57", "#6e7738",
      "#f26a36", "#2bb3c0", "#e03e52", "#52b788", "#b5179e",
      "#ffaa00", "#3a86ff", "#70e000"
    ],
    cyberpunk: [
      "#ff0055", "#00f0ff", "#ffe600", "#7000ff", "#00ff66",
      "#ff00aa", "#00b4d8", "#ff9e00", "#b5179e", "#38b000",
      "#ff5400", "#4cc9f0", "#f72585", "#7209b7", "#3a0ca3",
      "#4361ee", "#4895ef", "#06d6a0", "#118ab2", "#ef476f",
      "#ffd166", "#073b4c", "#e63946", "#a8dadc", "#457b9d",
      "#1d3557", "#f15bb5", "#fee440", "#00f5d4", "#9b5de5"
    ],
    pastel: [
      "#ffb5a7", "#fcd5ce", "#f8edeb", "#f9dcc4", "#fec89a",
      "#b7e4c7", "#95d5b2", "#74c69d", "#52b788", "#a2d2ff",
      "#bde0fe", "#ffafcc", "#ffc8dd", "#cdb4db", "#e2ece9",
      "#dfccf1", "#f0e6ef", "#d6e2e9", "#bcd4e6", "#99c1de",
      "#e0aaff", "#c77dff", "#9d4edd", "#7b2cbf", "#5a189a"
    ],
    solar: [
      "#d00000", "#dc2f02", "#e85d04", "#f48c06", "#faa307",
      "#ffba08", "#9d0208", "#6a040f", "#370617", "#ff4d6d",
      "#c9184a", "#ff758f", "#ff8fa3", "#e01e37", "#a71e34",
      "#bd1f36", "#da1e37", "#e01e37", "#eb1e37", "#f61e38"
    ],
    forest: [
      "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2",
      "#b7e4c7", "#d8f3dc", "#1b4332", "#081c15", "#1e6091",
      "#184e77", "#1a759f", "#168aad", "#34a0a4", "#52b69a",
      "#76c893", "#99d98c", "#b5e2fa", "#014f86", "#2c7da0"
    ]
  };

  let activePalette = PALETTES.classic;
  let world = null;
  let animationId = 0;
  let paused = false;
  let previousTime = performance.now();
  let accumulatedTime = 0;
  let resizeTimer = 0;
  let observedWidth = 0;
  let frameCount = 0;
  let lastFpsUpdate = performance.now();
  let territoryStats = [];

  // PRNG
  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getPaletteColor(owner) {
    return activePalette[owner % activePalette.length];
  }

  function readSettings() {
    const paletteKey = form.elements.paletteSelect ? form.elements.paletteSelect.value : "classic";
    activePalette = PALETTES[paletteKey] || PALETTES.classic;

    return {
      players: Math.max(2, Math.min(32, Number(form.elements.players.value) || 12)),
      ballsPerPlayer: Math.max(1, Math.min(10, Number(form.elements.ballsPerPlayer.value) || 1)),
      brick: Math.max(6, Math.min(40, Number(form.elements.brick.value) || 20)),
      speed: Math.max(0.2, Math.min(6.0, Number(form.elements.speed.value) || 1.7)),
      radius: Math.max(0.2, Math.min(1.2, Number(form.elements.radius.value) || 0.55)),
      seed: Math.max(1, Math.min(9999, Number(form.elements.seed.value) || 284)),
      palette: paletteKey
    };
  }

  function applyDeviceDefaults() {
    const shortestEdge = Math.min(window.innerWidth, window.innerHeight);
    if (shortestEdge <= 520) {
      form.elements.players.value = "8";
      form.elements.ballsPerPlayer.value = "1";
      form.elements.brick.value = "18";
      form.elements.speed.value = "1.2";
      form.elements.radius.value = "0.5";
    } else if (shortestEdge <= 850) {
      form.elements.players.value = "12";
      form.elements.ballsPerPlayer.value = "1";
      form.elements.brick.value = "20";
      form.elements.speed.value = "1.5";
      form.elements.radius.value = "0.55";
    }
  }

  function applyRandomSeed() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    form.elements.seed.value = String((values[0] % 999) + 1);
  }

  function updateOutputs() {
    for (const name of fields) {
      const input = form.elements[name];
      if (!input) continue;
      const output = document.querySelector(`#${name}-value`);
      if (output) {
        if (name === "speed") {
          output.value = `${Number(input.value).toFixed(1)}x`;
        } else if (name === "radius") {
          output.value = Number(input.value).toFixed(2);
        } else {
          output.value = input.value;
        }
      }
    }
    const totalBallsEl = document.querySelector("#total-balls-badge");
    if (totalBallsEl && form.elements.players && form.elements.ballsPerPlayer) {
      const total = Number(form.elements.players.value) * Number(form.elements.ballsPerPlayer.value);
      totalBallsEl.textContent = `${total} bolinhas`;
    }
  }

  function updateLiveSpeed() {
    if (!world) return;
    const nextSpeed = Number(form.elements.speed.value);
    const previousSpeed = world.settings.speed;
    if (!Number.isFinite(nextSpeed) || !Number.isFinite(previousSpeed) || previousSpeed <= 0) return;

    const ratio = nextSpeed / previousSpeed;
    for (const ball of world.balls) {
      ball.vx *= ratio;
      ball.vy *= ratio;
    }
    world.settings.speed = nextSpeed;
  }

  function makeSeeds(count, cols, rows, random) {
    const seeds = [];
    const candidates = Math.max(40, count * 16);
    for (let i = 0; i < candidates && seeds.length < count; i++) {
      const candidate = {
        x: 2 + random() * Math.max(1, cols - 4),
        y: 2 + random() * Math.max(1, rows - 4)
      };
      const separation = seeds.reduce((nearest, seed) => {
        return Math.min(nearest, Math.hypot(candidate.x - seed.x, candidate.y - seed.y));
      }, Infinity);
      const target = Math.sqrt((cols * rows) / count) * 0.52;
      if (separation > target || i > candidates - count + seeds.length) {
        seeds.push(candidate);
      }
    }
    return seeds;
  }

  function resetWorld() {
    const settings = readSettings();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(frame.clientWidth));
    const height = Math.max(1, Math.floor(frame.clientHeight));
    observedWidth = width;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cols = Math.max(10, Math.floor(width / settings.brick));
    const rows = Math.max(10, Math.floor(height / settings.brick));
    const cellW = width / cols;
    const cellH = height / rows;
    const random = mulberry32(settings.seed);
    const seeds = makeSeeds(settings.players, cols, rows, random);
    const cells = new Uint8Array(cols * rows);

    // Territory distribution by Voronoi
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let owner = 0;
        let nearest = Infinity;
        for (let i = 0; i < seeds.length; i++) {
          const dx = x + 0.5 - seeds[i].x;
          const dy = y + 0.5 - seeds[i].y;
          const distance = dx * dx + dy * dy;
          if (distance < nearest) {
            nearest = distance;
            owner = i;
          }
        }
        cells[y * cols + x] = owner;
      }
    }

    // Generate Balls (ballsPerPlayer per territory)
    const balls = [];
    const baseBallRadius = Math.min(cellW, cellH) * settings.radius;

    for (let owner = 0; owner < seeds.length; owner++) {
      const seed = seeds[owner];
      for (let b = 0; b < settings.ballsPerPlayer; b++) {
        // slight offset for multi-balls so they don't overlap completely
        const angle = random() * Math.PI * 2;
        const speedMultiplier = 0.95 + random() * 0.2;
        const baseSpeed = settings.brick * (19 + random() * 3.2) * settings.speed * speedMultiplier;
        const offsetX = (b === 0 ? 0 : (random() - 0.5) * cellW * 0.8);
        const offsetY = (b === 0 ? 0 : (random() - 0.5) * cellH * 0.8);

        balls.push({
          id: `${owner}-${b}`,
          owner,
          x: (seed.x + 0.5) * cellW + offsetX,
          y: (seed.y + 0.5) * cellH + offsetY,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
          radius: baseBallRadius,
          lastCapture: -1,
          captureCooldown: 0,
          tail: []
        });
      }
    }

    world = {
      width,
      height,
      cols,
      rows,
      cellW,
      cellH,
      cells,
      balls,
      settings,
      particles: [],
      totalCells: cols * rows
    };

    accumulatedTime = 0;
    previousTime = performance.now();
    setPaused(false);
    updateColorChips();
    updateTerritoryStats();
    draw();
  }

  function cellAt(x, y) {
    if (!world || x < 0 || y < 0 || x >= world.width || y >= world.height) return -1;
    const col = Math.floor(x / world.cellW);
    const row = Math.floor(y / world.cellH);
    if (col < 0 || col >= world.cols || row < 0 || row >= world.rows) return -1;
    return row * world.cols + col;
  }

  function isProtected(cellIndex, attacker) {
    if (cellIndex < 0) return true;
    const col = cellIndex % world.cols;
    const row = Math.floor(cellIndex / world.cols);
    for (const ball of world.balls) {
      if (ball.owner === attacker) continue;
      const ballCol = Math.floor(ball.x / world.cellW);
      const ballRow = Math.floor(ball.y / world.cellH);
      if (Math.abs(col - ballCol) <= 1 && Math.abs(row - ballRow) <= 1) return true;
    }
    return false;
  }

  function collisionCandidate(ball, nextX, nextY) {
    const samples = 16;
    const hits = [];
    const collisionRadius = Math.min(ball.radius, Math.min(world.cellW, world.cellH) * 0.42);

    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const sx = nextX + Math.cos(angle) * collisionRadius;
      const sy = nextY + Math.sin(angle) * collisionRadius;
      const index = cellAt(sx, sy);
      if (index < 0 || world.cells[index] !== ball.owner) {
        hits.push({ index, nx: Math.cos(angle), ny: Math.sin(angle) });
      }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => (b.nx * ball.vx + b.ny * ball.vy) - (a.nx * ball.vx + a.ny * ball.vy));

    const approaching = hits.filter((hit) => hit.nx * ball.vx + hit.ny * ball.vy > 0);
    const surface = approaching.length ? approaching : hits;
    let nx = 0;
    let ny = 0;
    for (const hit of surface) {
      nx += hit.nx;
      ny += hit.ny;
    }
    const length = Math.hypot(nx, ny) || 1;
    return { index: hits[0].index, nx: nx / length, ny: ny / length };
  }

  function findEscape(ball, reflectedAngle, distance) {
    const turn = Math.PI / 18;
    const offsets = [0];
    for (let i = 1; i <= 18; i++) offsets.push(i * turn, -i * turn);

    for (const offset of offsets) {
      const angle = reflectedAngle + offset;
      const x = ball.x + Math.cos(angle) * distance;
      const y = ball.y + Math.sin(angle) * distance;
      if (!collisionCandidate(ball, x, y)) return angle;
    }
    return reflectedAngle + Math.PI * 0.618;
  }

  function spawnConquestParticles(x, y, color) {
    if (!world || world.particles.length > 80) return;
    for (let i = 0; i < 4; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 40;
      world.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1.0,
        color
      });
    }
  }

  function moveBall(ball, dt) {
    ball.captureCooldown = Math.max(0, ball.captureCooldown - dt);
    const nextX = ball.x + ball.vx * dt;
    const nextY = ball.y + ball.vy * dt;
    const hit = collisionCandidate(ball, nextX, nextY);

    if (!hit) {
      ball.x = nextX;
      ball.y = nextY;
      return;
    }

    let conquered = false;
    if (hit.index >= 0 && hit.index !== ball.lastCapture && !isProtected(hit.index, ball.owner)) {
      const prevOwner = world.cells[hit.index];
      if (prevOwner !== ball.owner) {
        world.cells[hit.index] = ball.owner;
        ball.lastCapture = hit.index;
        ball.captureCooldown = 0.035;
        conquered = true;

        if (window.soundEngine) {
          window.soundEngine.playCapture(ball.owner, world.settings.players);
        }
        const col = hit.index % world.cols;
        const row = Math.floor(hit.index / world.cols);
        spawnConquestParticles((col + 0.5) * world.cellW, (row + 0.5) * world.cellH, getPaletteColor(ball.owner));
      }
    }

    if (!conquered && window.soundEngine) {
      window.soundEngine.playBounce();
    }

    const speed = Math.hypot(ball.vx, ball.vy);
    const dot = ball.vx * hit.nx + ball.vy * hit.ny;
    const reflectedX = ball.vx - 2 * dot * hit.nx;
    const reflectedY = ball.vy - 2 * dot * hit.ny;
    const probe = Math.max(1.5, Math.min(world.cellW, world.cellH) * 0.16);
    const angle = findEscape(ball, Math.atan2(reflectedY, reflectedX), probe);
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;

    const escapeX = ball.x + Math.cos(angle) * probe;
    const escapeY = ball.y + Math.sin(angle) * probe;
    if (!collisionCandidate(ball, escapeX, escapeY)) {
      ball.x = escapeX;
      ball.y = escapeY;
    }
  }

  function update(dt) {
    if (!world) return;
    const maxStep = 1 / 120;
    let remaining = Math.min(dt, 0.05);
    while (remaining > 0) {
      const step = Math.min(maxStep, remaining);
      for (const ball of world.balls) {
        moveBall(ball, step);
      }
      // Update particles
      for (let i = world.particles.length - 1; i >= 0; i--) {
        const p = world.particles[i];
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.life -= step * 3.5;
        if (p.life <= 0) world.particles.splice(i, 1);
      }
      remaining -= step;
    }
  }

  function updateTerritoryStats() {
    if (!world) return;
    const counts = new Uint32Array(world.settings.players);
    for (let i = 0; i < world.cells.length; i++) {
      const owner = world.cells[i];
      if (owner < world.settings.players) {
        counts[owner]++;
      }
    }

    territoryStats = [];
    for (let i = 0; i < world.settings.players; i++) {
      const percent = ((counts[i] / world.totalCells) * 100);
      territoryStats.push({ owner: i, count: counts[i], percent, color: getPaletteColor(i) });
    }
    territoryStats.sort((a, b) => b.count - a.count);

    // Update dominance bar
    if (dominanceBar) {
      dominanceBar.innerHTML = "";
      for (const stat of territoryStats) {
        if (stat.percent <= 0) continue;
        const segment = document.createElement("div");
        segment.className = "dominance-segment";
        segment.style.width = `${stat.percent.toFixed(2)}%`;
        segment.style.backgroundColor = stat.color;
        segment.title = `Cor #${stat.owner + 1}: ${stat.percent.toFixed(1)}% (Clique para selecionar no pincel)`;
        segment.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedBrushOwner(stat.owner);
        });
        dominanceBar.appendChild(segment);
      }
    }

    // Update mini leaderboard preview
    if (leaderboardList) {
      leaderboardList.innerHTML = "";
      const top3 = territoryStats.slice(0, 3);
      top3.forEach((item, rank) => {
        const badge = document.createElement("div");
        badge.className = "leader-item";
        badge.style.cursor = "pointer";
        badge.title = `Cor #${item.owner + 1} (${item.percent.toFixed(1)}%) - Clique para selecionar no pincel`;
        badge.innerHTML = `
          <span class="leader-dot" style="background:${item.color}"></span>
          <span class="leader-pct">${item.percent.toFixed(0)}%</span>
        `;
        badge.addEventListener("click", () => {
          setSelectedBrushOwner(item.owner);
        });
        leaderboardList.appendChild(badge);
      });
    }
  }

  // Brush Color Selector Logic
  function setSelectedBrushOwner(owner) {
    if (!world) return;
    if (owner < -1 || owner >= world.settings.players) {
      selectedBrushOwner = -1;
    } else {
      selectedBrushOwner = owner;
    }
    updateBrushUI();
  }

  function updateBrushUI() {
    if (!colorChipsContainer) return;
    const chips = colorChipsContainer.querySelectorAll(".chip-btn");
    chips.forEach((chip) => {
      const chipOwner = Number(chip.dataset.owner);
      const isActive = chipOwner === selectedBrushOwner;
      chip.classList.toggle("active", isActive);
    });

    if (brushSelectedDesc) {
      if (selectedBrushOwner === -1) {
        brushSelectedDesc.innerHTML = `🎲 Aleatório`;
      } else {
        const color = getPaletteColor(selectedBrushOwner);
        brushSelectedDesc.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle;border:1px solid rgba(0,0,0,0.2);"></span>Cor #${selectedBrushOwner + 1}`;
      }
    }
  }

  function updateColorChips() {
    if (!colorChipsContainer || !world) return;
    colorChipsContainer.innerHTML = "";

    // 1. "🎲 Aleatório" chip
    const randomChip = document.createElement("button");
    randomChip.type = "button";
    randomChip.className = `chip-btn ${selectedBrushOwner === -1 ? "active" : ""}`;
    randomChip.dataset.owner = "-1";
    randomChip.innerHTML = `<span>🎲 Aleatório</span>`;
    randomChip.addEventListener("click", () => {
      setSelectedBrushOwner(-1);
    });
    colorChipsContainer.appendChild(randomChip);

    // 2. Color Swatches for each player/territory
    for (let i = 0; i < world.settings.players; i++) {
      const color = getPaletteColor(i);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip-btn ${selectedBrushOwner === i ? "active" : ""}`;
      chip.dataset.owner = String(i);
      chip.title = `Selecionar Cor #${i + 1}`;
      chip.innerHTML = `
        <span class="chip-dot" style="background:${color};"></span>
        <span>Cor ${i + 1}</span>
      `;
      chip.addEventListener("click", () => {
        setSelectedBrushOwner(i);
      });
      colorChipsContainer.appendChild(chip);
    }

    updateBrushUI();
  }

  // Brush Size buttons
  radiusButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      radiusButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      brushRadius = Number(btn.dataset.radius) || 2;
    });
  });

  function draw() {
    if (!world) return;
    const isDark = document.body.classList.contains("dark-theme");
    ctx.fillStyle = isDark ? "#121316" : "#d8d4ca";
    ctx.fillRect(0, 0, world.width, world.height);

    // Draw Bricks
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        const owner = world.cells[y * world.cols + x];
        ctx.fillStyle = getPaletteColor(owner);
        const px = x * world.cellW;
        const py = y * world.cellH;
        ctx.fillRect(px + 0.45, py + 0.45, world.cellW - 0.9, world.cellH - 0.9);
      }
    }

    // Draw Particles
    for (const p of world.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1.0;

    // Draw Balls
    for (const ball of world.balls) {
      // Ball body
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? "#ffffff" : "#f4f1e9";
      ctx.fill();
      ctx.lineWidth = Math.max(1.25, ball.radius * 0.14);
      ctx.strokeStyle = isDark ? "#000000" : "#171713";
      ctx.stroke();

      // Ball inner color pupil
      ctx.beginPath();
      ctx.arc(
        ball.x - ball.radius * 0.25,
        ball.y - ball.radius * 0.25,
        ball.radius * 0.25,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = getPaletteColor(ball.owner);
      ctx.fill();
    }
  }

  let statsUpdateTimer = 0;
  function tick(now) {
    const dt = (now - previousTime) / 1000;
    previousTime = now;

    // FPS calculation
    frameCount++;
    if (now - lastFpsUpdate >= 500) {
      const currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
      if (fpsDisplay) fpsDisplay.textContent = `${currentFps} FPS`;
      frameCount = 0;
      lastFpsUpdate = now;
    }

    if (!paused) {
      accumulatedTime += dt;
      update(dt);
      draw();

      statsUpdateTimer += dt;
      if (statsUpdateTimer > 0.15) { // 6-7 times per second is smooth and high-perf
        updateTerritoryStats();
        statsUpdateTimer = 0;
      }

      const totalSeconds = Math.floor(accumulatedTime);
      elapsed.textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
    }
    animationId = requestAnimationFrame(tick);
  }

  function setPaused(value) {
    paused = value;
    pauseButton.classList.toggle("paused", paused);
    pauseLabel.textContent = paused ? "continuar" : "pausar";
    pauseButton.setAttribute("aria-label", paused ? "Continuar simulação" : "Pausar simulação");
    statusText.textContent = paused ? "pausado" : "rodando";
    statusDot.classList.toggle("paused", paused);
    previousTime = performance.now();
  }

  // Paint Function (single click or drag)
  function paintAt(x, y) {
    if (!world) return;
    const cellIdx = cellAt(x, y);
    if (cellIdx < 0) return;

    const ownerToUse = (selectedBrushOwner === -1)
      ? Math.floor(Math.random() * world.settings.players)
      : (selectedBrushOwner % world.settings.players);

    const c = cellIdx % world.cols;
    const r = Math.floor(cellIdx / world.cols);
    let changed = 0;

    for (let dy = -brushRadius; dy <= brushRadius; dy++) {
      for (let dx = -brushRadius; dx <= brushRadius; dx++) {
        const nc = c + dx;
        const nr = r + dy;
        if (nc >= 0 && nc < world.cols && nr >= 0 && nr < world.rows) {
          if (dx * dx + dy * dy <= brushRadius * brushRadius + 0.6) {
            const idx = nr * world.cols + nc;
            if (world.cells[idx] !== ownerToUse) {
              world.cells[idx] = ownerToUse;
              changed++;
            }
          }
        }
      }
    }

    if (changed > 0) {
      spawnConquestParticles(x, y, getPaletteColor(ownerToUse));
      if (window.soundEngine) {
        window.soundEngine.playCapture(ownerToUse, world.settings.players);
      }
      updateTerritoryStats();
      draw();
    }
  }

  // Pointer Painting Events (supports Click, Drag, Touch)
  canvas.addEventListener("pointerdown", (e) => {
    isPainting = true;
    const rect = canvas.getBoundingClientRect();
    paintAt(e.clientX - rect.left, e.clientY - rect.top);
  });

  window.addEventListener("pointermove", (e) => {
    if (!isPainting || !world) return;
    const rect = canvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
      paintAt(e.clientX - rect.left, e.clientY - rect.top);
    }
  });

  window.addEventListener("pointerup", () => {
    isPainting = false;
  });

  window.addEventListener("pointercancel", () => {
    isPainting = false;
  });

  // Sound toggle
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      if (window.soundEngine) {
        const isMuted = !window.soundEngine.toggle();
        soundBtn.classList.toggle("muted", isMuted);
        const icon = soundBtn.querySelector(".sound-icon");
        const label = soundBtn.querySelector(".sound-label");
        if (icon) icon.textContent = isMuted ? "🔇" : "🔊";
        if (label) label.textContent = isMuted ? "Mudo" : "Som ON";
      }
    });
  }

  // Random dice seed
  if (diceBtn) {
    diceBtn.addEventListener("click", () => {
      applyRandomSeed();
      updateOutputs();
      resetWorld();
    });
  }

  // Theme toggle
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
      const isDark = document.body.classList.contains("dark-theme");
      themeToggle.textContent = isDark ? "☀️ Claro" : "🌙 Escuro";
      draw();
    });
  }

  // Screenshot export
  if (screenshotBtn) {
    screenshotBtn.addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = `brick-territories-seed-${form.elements.seed.value}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }

  // Form listeners
  form.addEventListener("input", (event) => {
    updateOutputs();
    if (event.target === form.elements.speed) {
      updateLiveSpeed();
    } else if (event.target === form.elements.paletteSelect) {
      const settings = readSettings();
      activePalette = PALETTES[settings.palette] || PALETTES.classic;
      updateColorChips();
      updateTerritoryStats();
      draw();
    }
  });

  if (form.elements.paletteSelect) {
    form.elements.paletteSelect.addEventListener("change", () => {
      const settings = readSettings();
      activePalette = PALETTES[settings.palette] || PALETTES.classic;
      updateColorChips();
      updateTerritoryStats();
      draw();
    });
  }

  form.addEventListener("change", (event) => {
    if (event.target === form.elements.players ||
        event.target === form.elements.ballsPerPlayer ||
        event.target === form.elements.brick ||
        event.target === form.elements.radius ||
        event.target === form.elements.seed) {
      resetWorld();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    resetWorld();
  });

  pauseButton.addEventListener("click", () => setPaused(!paused));

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.target.matches("input, button, select")) {
      event.preventDefault();
      setPaused(!paused);
    }
    if (event.code === "KeyR" && !event.target.matches("input, button, select")) {
      event.preventDefault();
      resetWorld();
    }
  });

  const frameObserver = new ResizeObserver(([entry]) => {
    const width = Math.floor(entry.contentRect.width);
    if (Math.abs(width - observedWidth) < 2) return;
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resetWorld, 80);
  });
  frameObserver.observe(frame);

  applyDeviceDefaults();
  applyRandomSeed();
  updateOutputs();
  resetWorld();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(tick);
})();
