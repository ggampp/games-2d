import { MAPS, MAP_BY_ID } from './maps.js';
import {
  DEFAULT_RULES,
  compileMap,
  createState,
  legalMoves,
  applyMove,
  gameStatus,
  countPieces,
  other,
  PASS,
} from './engine.js';
import { chooseMove, LEVELS as AI_LEVELS } from './ai.js';
import { LEVELS, LEVEL_BY_ID, starsFor } from './levels.js';
import { BoardView, mapThumbnail } from './render.js';
import { sfx, setSound, unlockAudio } from './audio.js';
import { load, save } from './storage.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAMES = { 1: 'Tomates', 2: 'Karelas' };
const SINGULAR = { 1: 'tomate', 2: 'karela' };
const OF = { 1: 'dos Tomates', 2: 'das Karelas' };
const THE = { 1: 'Os Tomates', 2: 'As Karelas' };

const settings = load('settings', {
  map: 'borboleta',
  mode: 'cpu',
  side: 1,
  ai: 'medio',
  first: 1,
  forceCapture: DEFAULT_RULES.forceCapture,
  arcJumps: DEFAULT_RULES.arcJumps,
  blockedLoses: DEFAULT_RULES.blockedLoses,
  sound: true,
});
const progress = load('progress', {}); // { [levelId]: estrelas }
setSound(settings.sound);

// ---------------------------------------------------------------- IA (worker)
let worker = null;
let reqSeq = 0;
const pending = new Map();
try {
  worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const cb = pending.get(e.data.id);
    pending.delete(e.data.id);
    cb?.(e.data.move);
  };
  worker.onerror = () => {
    worker = null;
  };
} catch {
  worker = null;
}

function askAI(g, level, state = g.state) {
  const id = ++reqSeq;
  return new Promise((resolve) => {
    if (worker) {
      pending.set(id, resolve);
      worker.postMessage({ id, mapId: g.def.id, rules: g.rules, state, level });
    } else {
      setTimeout(() => resolve(chooseMove(g.map, state, g.rules, level)), 30);
    }
  });
}

// ---------------------------------------------------------------- telas
function show(screen) {
  $$('.screen').forEach((s) => (s.hidden = s.dataset.screen !== screen));
  if (screen === 'campaign') renderCampaign();
  if (screen === 'setup') renderSetup();
  if (screen !== 'game') game = null;
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  unlockAudio();
  const go = e.target.closest('[data-go]');
  if (go) return show(go.dataset.go);
  const act = e.target.closest('[data-action]');
  if (act) actions[act.dataset.action]?.();
});

const actions = {
  rules: () => openRules(),
  sound: () => {
    settings.sound = !settings.sound;
    setSound(settings.sound);
    save('settings', settings);
    updateSoundBtn();
  },
  leave: () => {
    if (game && !game.over && game.history.length) {
      modal(
        '<h3>Sair da partida?</h3><p>O andamento desta partida será perdido.</p>',
        [
          ['Continuar jogando', null],
          ['Sair', () => show(game?.level ? 'campaign' : 'setup'), 'danger'],
        ],
      );
    } else show(game?.level ? 'campaign' : 'setup');
  },
  undo: () => undo(),
  hint: () => hint(),
  restart: () => game && startGame(game.config),
};

function updateSoundBtn() {
  const b = $('#sound-btn');
  b.textContent = settings.sound ? '🔊' : '🔇';
  b.setAttribute('aria-label', settings.sound ? 'Desligar som' : 'Ligar som');
}

// ---------------------------------------------------------------- modal
const dlg = $('#modal');
function modal(html, buttons = [['OK', null]], { dismissable = true } = {}) {
  $('#modal-body').innerHTML = html;
  const bar = $('#modal-actions');
  bar.innerHTML = '';
  for (const [label, fn, kind] of buttons) {
    const b = document.createElement('button');
    b.className = `btn ${kind || (buttons.length === 1 ? 'primary' : '')}`;
    b.textContent = label;
    b.addEventListener('click', () => {
      dlg.close();
      fn?.();
    });
    bar.appendChild(b);
  }
  dlg.dataset.dismissable = dismissable ? '1' : '';
  if (!dlg.open) dlg.showModal();
  bar.lastElementChild?.focus();
}
dlg.addEventListener('cancel', (e) => {
  if (!dlg.dataset.dismissable) e.preventDefault();
});

function openRules() {
  modal(
    `<h3>Como jogar</h3>
    <ol class="rules">
      <li><b>Objetivo:</b> capturar todas as peças do adversário.</li>
      <li><b>Andar:</b> na sua vez, leve uma peça pela linha até uma casa vizinha <i>vazia</i>.</li>
      <li><b>Capturar:</b> se uma peça adversária estiver colada à sua e a casa logo atrás, na mesma linha, estiver livre, salte por cima dela e retire-a do tabuleiro.</li>
      <li><b>Em cadeia:</b> depois de um salto, se ainda houver captura, a mesma peça continua saltando no mesmo lance.</li>
      <li><b>Captura obrigatória</b> (padrão): havendo salto, é preciso saltar.</li>
      <li><b>Sem lances:</b> por padrão quem não pode se mexer passa a vez. Nas regras da partida livre dá para tornar isso derrota.</li>
      <li><b>Empate:</b> 40 lances seguidos sem nenhuma captura, ou ninguém consegue se mexer.</li>
      <li><b>Pedras</b> bloqueiam casas: não se para nelas nem se salta por cima.</li>
    </ol>
    <p class="muted">Clique (ou toque) numa peça com contorno para selecioná-la, depois no destino. Pelo teclado, use Tab e Enter.</p>`,
  );
}

// ---------------------------------------------------------------- menu
function heroBoard() {
  const def = MAP_BY_ID.borboleta;
  const map = compileMap(def);
  const st = createState(map);
  const svg = mapThumbnail(map, st.board);
  const hero = $('#hero-board');
  hero.replaceWith(svg);
  svg.id = 'hero-board';
  svg.classList.add('hero-board');
}

// ---------------------------------------------------------------- campanha
function unlocked(levelId) {
  return levelId === 1 || (progress[levelId - 1] || 0) > 0;
}

function renderCampaign() {
  const grid = $('#level-grid');
  grid.innerHTML = '';
  let total = 0;
  for (const lv of LEVELS) {
    const stars = progress[lv.id] || 0;
    total += stars;
    const open = unlocked(lv.id);
    const def = MAP_BY_ID[lv.map];
    const map = compileMap(def);
    const st = createState(map, lv.setup);
    const card = document.createElement('button');
    card.className = `level-card${open ? '' : ' locked'}${stars ? ' done' : ''}`;
    card.disabled = !open;
    card.innerHTML = `<span class="lv-num">${lv.id}</span>
      <span class="lv-name">${lv.name}</span>
      <span class="lv-meta">${def.name} · ${lv.limit ? 'quebra-cabeça' : AI_LEVELS[lv.ai].label}</span>
      <span class="stars" aria-label="${stars} de 3 estrelas">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></span>
      ${open ? '' : '<span class="lock" aria-label="Bloqueada">🔒</span>'}`;
    card.prepend(mapThumbnail(map, st.board));
    card.addEventListener('click', () => levelIntro(lv));
    grid.appendChild(card);
  }
  $('#star-total').textContent = `★ ${total}/${LEVELS.length * 3}`;
}

function levelIntro(lv) {
  const side = lv.side || 1;
  const goals = lv.limit
    ? `<li>Vença em ${lv.limit === 1 ? 'um único lance' : `até ${lv.limit} lances`}.</li>`
    : `<li>★ Vencer</li><li>★ Perder no máximo ${lv.maxLoss} peças</li><li>★ Vencer em até ${lv.par} lances</li>`;
  modal(
    `<p class="eyebrow">Fase ${lv.id} · ${MAP_BY_ID[lv.map].name}</p>
     <h3>${lv.name}</h3>
     <p>${lv.intro}</p>
     <p class="muted">Você joga com ${side === 1 ? 'os <b>Tomates</b>' : 'as <b>Karelas</b>'}${lv.limit ? '' : ` contra o computador (${AI_LEVELS[lv.ai].label})`}.</p>
     <ul class="goals">${goals}</ul>`,
    [
      ['Voltar', null],
      ['Jogar', () => startLevel(lv), 'primary'],
    ],
  );
}

function startLevel(lv) {
  const side = lv.side || 1;
  startGame({
    mapId: lv.map,
    setup: lv.setup,
    rules: { ...DEFAULT_RULES, ...(lv.rules || {}) },
    players: { [side]: 'human', [other(side)]: 'cpu' },
    ai: lv.ai,
    first: lv.first || 1,
    level: lv,
  });
}

// ---------------------------------------------------------------- partida livre
function renderSetup() {
  const form = $('#setup-form');
  const grid = $('#map-grid');
  grid.innerHTML = '';
  for (const def of MAPS) {
    const map = compileMap(def);
    const st = createState(map);
    const label = document.createElement('label');
    label.className = 'map-card';
    label.innerHTML = `<input type="radio" name="map" value="${def.id}" ${settings.map === def.id ? 'checked' : ''} />
      <span class="map-info"><b>${def.name}</b><small>${def.subtitle}</small><span>${def.description}</span></span>`;
    label.insertBefore(mapThumbnail(map, st.board), label.querySelector('.map-info'));
    grid.appendChild(label);
  }
  const seg = $('#difficulty-seg');
  seg.innerHTML = Object.entries(AI_LEVELS)
    .map(
      ([k, v]) => `<label><input type="radio" name="ai" value="${k}" ${settings.ai === k ? 'checked' : ''}/><span>${v.label}</span></label>`,
    )
    .join('');
  form.mode.value = settings.mode;
  form.side.value = String(settings.side);
  form.first.value = String(settings.first);
  form.forceCapture.checked = settings.forceCapture;
  form.arcJumps.checked = settings.arcJumps;
  form.blockedLoses.checked = settings.blockedLoses;
  syncSetup();
}

function syncSetup() {
  const form = $('#setup-form');
  const cpu = form.mode.value === 'cpu';
  $$('.cpu-only', form).forEach((f) => (f.hidden = !cpu));
}

$('#setup-form').addEventListener('change', syncSetup);
$('#setup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  Object.assign(settings, {
    map: f.map.value || 'borboleta',
    mode: f.mode.value,
    side: Number(f.side.value),
    ai: f.ai.value,
    first: Number(f.first.value),
    forceCapture: f.forceCapture.checked,
    arcJumps: f.arcJumps.checked,
    blockedLoses: f.blockedLoses.checked,
  });
  save('settings', settings);
  const side = settings.side;
  startGame({
    mapId: settings.map,
    rules: {
      ...DEFAULT_RULES,
      forceCapture: settings.forceCapture,
      arcJumps: settings.arcJumps,
      blockedLoses: settings.blockedLoses,
    },
    players: settings.mode === 'cpu' ? { [side]: 'human', [other(side)]: 'cpu' } : { 1: 'human', 2: 'human' },
    ai: settings.ai,
    first: settings.first || (Math.random() < 0.5 ? 1 : 2),
  });
});

// ---------------------------------------------------------------- partida
let game = null;
let lastPortrait = null;
const view = new BoardView($('#board'), { onNodeClick: (i) => onNodeClick(i) });

function isPortrait() {
  const w = $('#board-wrap');
  return w.clientWidth < w.clientHeight * 0.95;
}

function startGame(config) {
  dlg.open && dlg.close();
  show('game');
  const def = MAP_BY_ID[config.mapId];
  const map = compileMap(def, config.rules);
  const state = createState(map, { ...(config.setup || {}), first: config.first });
  game = {
    config,
    def,
    map,
    rules: config.rules,
    state,
    start: { 1: countPieces(state, 1), 2: countPieces(state, 2) },
    history: [],
    players: config.players,
    ai: config.ai,
    level: config.level || null,
    sel: null,
    prefix: [],
    hint: null,
    busy: false,
    over: false,
    token: Symbol('game'),
  };
  $('#game-title').textContent = game.level ? `${game.level.id}. ${game.level.name}` : def.name;
  const vsCpu = Object.values(game.players).includes('cpu');
  for (const p of [1, 2]) {
    $(`#who-${p}`).textContent = vsCpu
      ? game.players[p] === 'human' ? 'Você' : `Computador · ${AI_LEVELS[game.ai].label}`
      : `Jogador ${p}`;
  }
  $('#hint-btn').hidden = !vsCpu;
  lastPortrait = isPortrait();
  view.setMap(map, lastPortrait);
  view.setPieces(state.board);
  view.showLast(null);
  updateSoundBtn();
  nextTurn();
}

const humanTurn = (g = game) => g && !g.over && g.players[g.state.turn] === 'human';
const humanSide = (g = game) => (g.players[1] === 'human' ? 1 : 2);

function playerMoves(g = game) {
  const side = humanSide(g);
  const moveFrom = (k) => (k + 1 < g.history.length ? g.history[k + 1] : g.state).last;
  return g.history.filter((s, k) => s.turn === side && !moveFrom(k)?.pass).length;
}

function setStatus(text, tone = '') {
  const s = $('#status');
  s.textContent = text;
  s.dataset.tone = tone;
}

function updateHud() {
  const g = game;
  for (const p of [1, 2]) {
    $(`#count-${p}`).textContent = countPieces(g.state, p);
    $(`#panel-${p}`).classList.toggle('active', !g.over && g.state.turn === p);
  }
  $('#undo-btn').disabled = g.busy || !g.history.length || !Object.values(g.players).includes('human');
  $('#hint-btn').disabled = g.busy || !humanTurn();
  const goal = $('#goal');
  if (g.level) {
    const n = playerMoves();
    goal.textContent = g.level.limit ? `Lances: ${n}/${g.level.limit}` : `Lances: ${n} · meta ${g.level.par}`;
  } else goal.textContent = `Sem captura: ${g.state.quiet}/${g.rules.quietLimit}`;
}

async function nextTurn() {
  const g = game;
  g.sel = null;
  g.prefix = [];
  g.hint = null;
  g.moves = legalMoves(g.map, g.state, g.rules);
  updateHud();
  const st = gameStatus(g.map, g.state, g.rules);
  if (st.over) return endGame(st);

  // Quebra-cabeça: esgotou os lances sem vencer.
  if (g.level?.limit && g.state.turn !== humanSide() && playerMoves() >= g.level.limit) {
    return endGame({ over: true, winner: other(humanSide()), reason: 'puzzle' });
  }

  const turn = g.state.turn;
  const vsCpu = Object.values(g.players).includes('cpu');
  if (g.moves[0]?.pass) {
    setStatus(`${THE[turn]} estão sem lances e passam a vez`, 'warn');
    view.highlight({});
    g.busy = true;
    await sleep(1100);
    if (game !== g) return;
    g.busy = false;
    return commit(PASS);
  }

  if (g.players[turn] === 'cpu') {
    g.busy = true;
    updateHud();
    setStatus('Computador pensando…', 'cpu');
    view.highlight({});
    const t0 = performance.now();
    const move = await askAI(g, g.ai);
    const wait = 450 - (performance.now() - t0);
    if (wait > 0) await sleep(wait);
    if (game !== g || !move) return;
    await playAnimated(move);
    if (game !== g) return;
    g.busy = false;
    return commit(move);
  }

  const capt = g.moves[0]?.caps.length > 0 && g.rules.forceCapture;
  const who = vsCpu ? 'Sua vez' : `Vez ${OF[turn]}`;
  setStatus(capt ? `${who}: captura obrigatória!` : `${who}: escolha ${turn === 1 ? 'um tomate' : 'uma karela'}`, capt ? 'capture' : '');
  refreshHighlights();
}

async function playAnimated(move) {
  let at = move.from;
  for (let k = 0; k < move.steps.length; k++) {
    const cap = move.caps[k] ?? null;
    const p = view.animateStep(at, move.steps[k], cap);
    setTimeout(() => (cap != null ? sfx.capture() : sfx.move()), cap != null ? 170 : 200);
    await p;
    at = move.steps[k];
  }
}

function commit(move) {
  const g = game;
  g.history.push(g.state);
  g.state = applyMove(g.state, move);
  view.showLast(move);
  view.updateLabels(g.state.board);
  nextTurn();
}

function candidates() {
  const g = game;
  return g.moves.filter((m) => m.from === g.sel && g.prefix.every((s, k) => m.steps[k] === s));
}

function refreshHighlights() {
  const g = game;
  if (!humanTurn() || g.busy) return view.highlight({});
  const selectable = [...new Set(g.moves.map((m) => m.from))];
  if (g.sel == null) return view.highlight({ selectable, hint: g.hint });
  const k = g.prefix.length;
  const cands = candidates();
  const seen = new Map();
  for (const m of cands) seen.set(m.steps[k], { node: m.steps[k], capture: m.caps.length > k });
  view.highlight({
    selectable: k ? [] : selectable.filter((i) => i !== g.sel),
    selected: k ? g.prefix[k - 1] : g.sel,
    targets: [...seen.values()],
    hint: g.hint,
  });
}

async function onNodeClick(i) {
  const g = game;
  if (!g || !humanTurn() || g.busy) return;
  const board = g.state.board;

  if (g.sel != null) {
    const k = g.prefix.length;
    const next = candidates().filter((m) => m.steps[k] === i);
    if (next.length) {
      const prefix = [...g.prefix, i];
      const at = k ? g.prefix[k - 1] : g.sel;
      const complete = next.find((m) => m.steps.length === prefix.length);
      g.busy = true;
      view.highlight({});
      const cap = next[0].caps[k] ?? null;
      setTimeout(() => (cap != null ? sfx.capture() : sfx.move()), cap != null ? 170 : 200);
      await view.animateStep(at, i, cap);
      if (game !== g) return;
      g.busy = false;
      if (complete) return commit(complete);
      g.prefix = prefix;
      setStatus('Continue saltando!', 'capture');
      return refreshHighlights();
    }
    if (k > 0) {
      sfx.invalid();
      return setStatus('Termine a sequência de saltos', 'warn');
    }
    if (i === g.sel) {
      g.sel = null;
      return refreshHighlights();
    }
  }

  if (board[i] === g.state.turn) {
    if (g.moves.some((m) => m.from === i)) {
      g.sel = i;
      sfx.select();
      return refreshHighlights();
    }
    sfx.invalid();
    view.pulse(i);
    const forced = g.rules.forceCapture && g.moves[0]?.caps.length;
    setStatus(forced ? 'Há captura obrigatória com outra peça' : `Esse ${SINGULAR[g.state.turn]} não tem para onde ir`, 'warn');
    return;
  }
  g.sel = null;
  refreshHighlights();
}

function undo() {
  const g = game;
  if (!g || g.busy || !g.history.length) return;
  const side = humanSide();
  const vsCpu = Object.values(g.players).includes('cpu');
  g.state = g.history.pop();
  // Contra o computador, volte até a sua vez.
  while (vsCpu && g.state.turn !== side && g.history.length) g.state = g.history.pop();
  g.over = false;
  view.setPieces(g.state.board);
  view.showLast(g.state.last);
  dlg.open && dlg.close();
  nextTurn();
}

async function hint() {
  const g = game;
  if (!g || !humanTurn() || g.busy) return;
  g.busy = true;
  updateHud();
  setStatus('Pensando numa dica…', 'cpu');
  const move = await askAI(g, 'dificil');
  if (game !== g) return;
  g.busy = false;
  g.sel = null;
  g.prefix = [];
  g.hint = move;
  updateHud();
  setStatus('Dica: siga a linha tracejada', 'hint');
  refreshHighlights();
}

function endGame(st) {
  const g = game;
  g.over = true;
  g.busy = false;
  updateHud();
  view.highlight({});
  const vsCpu = Object.values(g.players).includes('cpu');
  const side = humanSide();
  const reasons = {
    capture: 'Todas as peças adversárias foram capturadas.',
    blocked: `${THE[g.state.turn]} ficaram sem lances.`,
    quiet: `${g.rules.quietLimit} lances seguidos sem captura.`,
    stalemate: 'Ninguém consegue mais se mexer.',
    puzzle: 'Os lances do quebra-cabeça acabaram antes da vitória.',
  };
  let title;
  let tone;
  if (st.winner === 0) {
    title = 'Empate';
    tone = 'draw';
  } else if (!vsCpu) {
    title = `${THE[st.winner]} vencem!`;
    tone = 'win';
  } else if (st.winner === side) {
    title = 'Vitória!';
    tone = 'win';
  } else {
    title = st.reason === 'puzzle' ? 'Não foi dessa vez' : 'Derrota';
    tone = 'lose';
  }
  setStatus(title, tone);
  tone === 'win' ? sfx.win() : tone === 'lose' ? sfx.lose() : null;

  let starsHtml = '';
  const buttons = [];
  if (g.level) {
    const lv = g.level;
    const won = vsCpu && st.winner === side;
    let stars = 0;
    if (won) {
      stars = starsFor(lv, { playerMoves: playerMoves(), piecesLost: g.start[side] - countPieces(g.state, side) });
      if (stars > (progress[lv.id] || 0)) {
        progress[lv.id] = stars;
        save('progress', progress);
      }
      for (let k = 0; k < stars; k++) sfx.star(k);
      const lost = g.start[side] - countPieces(g.state, side);
      starsHtml = `<p class="big-stars" aria-label="${stars} de 3 estrelas">${[0, 1, 2]
        .map((k) => `<span class="${k < stars ? 'on' : ''}" style="--d:${k * 0.22 + 0.2}s">★</span>`)
        .join('')}</p>
        ${lv.limit ? '' : `<p class="muted">${playerMoves()} lances (meta ${lv.par}) · ${lost} peça${lost === 1 ? '' : 's'} perdida${lost === 1 ? '' : 's'} (máx. ${lv.maxLoss})</p>`}`;
    }
    buttons.push(['Fases', () => show('campaign')]);
    buttons.push(['Jogar de novo', () => startLevel(lv)]);
    const nextLv = LEVEL_BY_ID[lv.id + 1];
    if (won && nextLv) buttons.push(['Próxima fase', () => levelIntro(nextLv), 'primary']);
    else if (won) buttons.push(['Fim da campanha!', () => show('campaign'), 'primary']);
    else buttons[1][2] = 'primary';
  } else {
    buttons.push(['Menu', () => show('menu')]);
    buttons.push(['Ver tabuleiro', null]);
    buttons.push(['Jogar de novo', () => startGame(g.config), 'primary']);
  }
  setTimeout(() => {
    if (game !== g) return;
    modal(`<h3 class="result ${tone}">${title}</h3><p>${reasons[st.reason] || ''}</p>${starsHtml}`, buttons);
  }, 650);
}

// Reorienta o tabuleiro (retrato/paisagem) quando a área muda.
new ResizeObserver(() => {
  if (!game) return;
  const p = isPortrait();
  if (p === lastPortrait || game.busy) return;
  lastPortrait = p;
  view.setMap(game.map, p);
  view.setPieces(game.state.board);
  view.showLast(game.state.last);
  refreshHighlights();
}).observe($('#board-wrap'));

// ---------------------------------------------------------------- início
heroBoard();
updateSoundBtn();
show('menu');

// Gancho para testes automatizados.
window.__guti = {
  get game() {
    return game;
  },
  startLevel: (id) => startLevel(LEVEL_BY_ID[id]),
  click: (nodeId) => onNodeClick(game.map.idx(nodeId)),
};
