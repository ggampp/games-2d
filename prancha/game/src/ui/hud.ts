import { BIOME_ORDER, BIOMES, levelsOf, type LevelDef, type SandboxOptions } from "../levels/catalog.ts";
import type { CostBreakdown } from "../sim/bridge.ts";
import type { BiomeId } from "../sim/layout.ts";
import { MATERIAL_ORDER, MATERIALS, SAFETY, type MaterialId } from "../sim/materials.ts";
import { brl, type Verdict } from "../sim/scoring.ts";
import type { Progress } from "../state/progress.ts";

export type ScreenId = "menu" | "caderno" | "briefing" | "play" | "collapse" | "report" | "sandbox" | "gallery";

const SCREENS: ScreenId[] = ["menu", "caderno", "briefing", "play", "collapse", "report", "sandbox", "gallery"];

export interface PlayStats {
  level: LevelDef;
  costs: CostBreakdown;
  fs: number | null;
  testing: boolean;
  windKmh: number;
  windNow: number;
  phase: string | null;
}

export class Hud {
  private readonly screens = new Map<ScreenId, HTMLElement>();

  constructor() {
    for (const id of SCREENS) this.screens.set(id, el(`screen-${id}`));
    const span = el("sb-span") as HTMLInputElement;
    const bind = (input: string, out: string) => {
      const i = el(input) as HTMLInputElement;
      const o = el(out);
      const sync = () => (o.textContent = i.value);
      i.addEventListener("input", sync);
      sync();
    };
    bind("sb-span", "sb-span-out");
    bind("sb-load", "sb-load-out");
    bind("sb-wind", "sb-wind-out");
    bind("sb-tide", "sb-tide-out");
    span.dispatchEvent(new Event("input"));
  }

  show(id: ScreenId): void {
    for (const [key, node] of this.screens) node.classList.toggle("is-on", key === id);
  }

  setMuted(muted: boolean): void {
    const b = el("btn-mute");
    b.textContent = muted ? "SOM OFF" : "SOM ON";
    b.classList.toggle("is-off", muted);
  }

  // ---------- menu ----------

  fillMenu(progress: Progress, maxId: number): void {
    const cont = el("btn-continue") as HTMLButtonElement;
    cont.disabled = progress.totalStars() === 0 && !progress.design(1);
    el("menu-progress").textContent = `ESTRELAS: ${progress.totalStars()} / ${maxId * 3}`;
  }

  // ---------- caderno ----------

  fillCaderno(
    biome: BiomeId,
    progress: Progress,
    onBiome: (b: BiomeId) => void,
    onLevel: (id: number) => void,
  ): void {
    const tabs = el("biome-tabs");
    tabs.innerHTML = "";
    for (const id of BIOME_ORDER) {
      const def = BIOMES[id];
      const levels = levelsOf(id);
      const stars = levels.reduce((s, l) => s + progress.stars(l.id), 0);
      const locked = !progress.isUnlocked(levels[0].id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "biome-tab";
      btn.classList.toggle("is-active", id === biome);
      btn.classList.toggle("is-locked", locked);
      btn.innerHTML = `<span>${def.name}</span><small>${locked ? "🔒" : `★ ${stars}/${levels.length * 3}`}</small>`;
      btn.addEventListener("click", () => onBiome(id));
      tabs.appendChild(btn);
    }

    const def = BIOMES[biome];
    el("biome-name").textContent = def.name.toUpperCase();
    el("biome-sub").textContent = def.subtitle;
    const list = el("level-list");
    list.innerHTML = "";
    const levels = levelsOf(biome);
    let stars = 0;
    for (const l of levels) {
      const s = progress.stars(l.id);
      stars += s;
      const unlocked = progress.isUnlocked(l.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "obra";
      btn.disabled = !unlocked;
      btn.innerHTML =
        `<span class="num">${String(l.id).padStart(2, "0")}</span>` +
        `<span><span class="name">${l.name}</span><span class="meta">${l.spanM.toFixed(0)} m · ${l.load} · ${l.restriction}</span></span>` +
        `<span class="stars">${starText(s)}</span>`;
      btn.addEventListener("click", () => onLevel(l.id));
      list.appendChild(btn);
    }
    el("biome-bar").style.width = `${(stars / (levels.length * 3)) * 100}%`;
  }

  // ---------- memorial ----------

  fillBriefing(level: LevelDef, hasSaved: boolean): void {
    const isSandbox = level.id === 0;
    el("brief-title").textContent = isSandbox
      ? "MEMORIAL DESCRITIVO — SANDBOX"
      : `MEMORIAL DESCRITIVO — OBRA ${String(level.id).padStart(2, "0")}`;
    el("brief-name").textContent = `${level.name.toUpperCase()} · ${BIOMES[level.biome].name.toUpperCase()}`;
    el("brief-span").textContent = `${level.spanM.toFixed(2)} m`;
    el("brief-load").textContent = level.load;
    el("brief-budget").textContent = brl(level.budget);
    el("brief-note").textContent = level.restriction;
    el("brief-teach").textContent = level.teaches;
    el("brief-saved").textContent = hasSaved ? "Projeto anterior será carregado na prancheta." : "";

    const chips: string[] = [];
    const m = level.mods;
    if (m.windKmh) chips.push(`VENTO ${m.windKmh} km/h${m.gusts ? " · RAJADAS" : ""}`);
    if (m.tideRiseM) chips.push(`MARÉ +${m.tideRiseM.toFixed(1)} m`);
    if (m.settlementM) chips.push(`RECALQUE ${(m.settlementM * 100).toFixed(0)} cm`);
    if (m.clearance) chips.push(`GABARITO ${m.clearance.heightM} m`);
    if (m.piers === "forbidden") chips.push("SEM PILAR NO LEITO");
    else if (m.piers && m.piers.cost) chips.push(`FUNDAÇÃO ${brl(m.piers.cost)}`);
    if (m.deadLoadMul) chips.push(`ESCORAMENTO ×${m.deadLoadMul}`);
    if (m.deflectionDiv) chips.push(`FLECHA L/${m.deflectionDiv}`);
    if (m.quotaM) for (const [k, v] of Object.entries(m.quotaM)) chips.push(`${MATERIALS[k as MaterialId].name.toUpperCase()}: ${v} m`);
    if (m.prebuilt?.length) chips.push("ESTRUTURA TOMBADA");
    if (m.vehicles && m.vehicles.length > 1) chips.push(`${m.vehicles.length} VEÍCULOS`);
    if (m.noRightLowAnchor) chips.push("SEM APOIO BAIXO À DIREITA");
    const mats = level.catalog.map((id) => `<li class="mat">${MATERIALS[id].short}</li>`).join("");
    el("brief-mods").innerHTML = chips.map((c) => `<li>${c}</li>`).join("") + mats;
  }

  // ---------- play ----------

  bindToolbox(ids: MaterialId[], active: MaterialId, onPick: (id: MaterialId) => void): void {
    const box = el("toolbox");
    box.innerHTML = "";
    MATERIAL_ORDER.forEach((id, i) => {
      const mat = MATERIALS[id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tool";
      btn.dataset.id = id;
      const locked = !ids.includes(id);
      btn.classList.toggle("is-locked", locked);
      btn.classList.toggle("is-active", id === active && !locked);
      const price = mat.unitCost ? `${brl(mat.unitCost)}/un` : `${brl(mat.costPerMeter)}/m`;
      btn.innerHTML = `<img src="${mat.icon}" alt="" /><span>${mat.name}<small data-quota="${id}">${price} · máx ${mat.maxLengthM} m</small></span><span class="key">${i + 1}</span>`;
      btn.disabled = locked;
      btn.addEventListener("click", () => {
        if (!locked) onPick(id);
      });
      box.appendChild(btn);
    });
  }

  setActiveTool(id: MaterialId): void {
    for (const btn of document.querySelectorAll<HTMLButtonElement>(".tool")) {
      btn.classList.toggle("is-active", btn.dataset.id === id && !btn.classList.contains("is-locked"));
    }
  }

  setQuota(level: LevelDef, used: (id: MaterialId) => number): void {
    for (const small of document.querySelectorAll<HTMLElement>("[data-quota]")) {
      const id = small.dataset.quota as MaterialId;
      const mat = MATERIALS[id];
      const quota = level.mods.quotaM?.[id];
      const price = mat.unitCost ? `${brl(mat.unitCost)}/un` : `${brl(mat.costPerMeter)}/m`;
      if (quota !== undefined) {
        const u = used(id);
        small.textContent = `${price} · ${u.toFixed(0)}/${quota} m`;
        small.closest(".tool")?.classList.toggle("is-quota-out", u >= quota - 0.01);
      } else {
        small.textContent = `${price} · máx ${mat.maxLengthM} m`;
      }
    }
  }

  fillPlay(s: PlayStats): void {
    const { level, costs } = s;
    el("hud-level").textContent =
      level.id === 0
        ? `SANDBOX — ${BIOMES[level.biome].name.toUpperCase()}`
        : `OBRA ${String(level.id).padStart(2, "0")} — ${level.name.toUpperCase()}`;
    el("hud-span").textContent = `${level.spanM.toFixed(2)} m`;
    const cost = el("hud-cost");
    cost.textContent = brl(costs.total);
    const over = Number.isFinite(level.budget) && costs.total > level.budget;
    cost.className = over ? "is-bad" : costs.total > level.budget * 0.8 ? "is-warn" : "";
    el("hud-budget").textContent = brl(level.budget);
    const fsEl = el("hud-fs");
    if (s.fs === null) {
      fsEl.textContent = "—";
      fsEl.className = "";
    } else {
      fsEl.textContent = s.fs.toFixed(2);
      fsEl.className = s.fs < SAFETY.fsPass ? "is-bad" : s.fs < SAFETY.fsThreeStar ? "is-warn" : "is-ok";
    }
    const windBox = el("hud-wind-box");
    windBox.classList.toggle("is-on", s.windKmh > 0);
    if (s.windKmh > 0) {
      const live = s.testing ? Math.round(s.windKmh * Math.sqrt(Math.max(0, s.windNow) / (s.windKmh * s.windKmh * 0.035 || 1))) : s.windKmh;
      el("hud-wind").textContent = `${live} km/h →`;
    }
    const phase = el("hud-phase");
    phase.classList.toggle("is-on", !!s.phase);
    phase.textContent = s.phase ?? "";
    el("btn-test").classList.toggle("is-pulse", !s.testing);
    el("test-actions").classList.toggle("is-on", s.testing);
    el("build-actions").classList.toggle("is-on", !s.testing);
  }

  setHint(text: string, error = false): void {
    const h = el("hud-hint");
    h.textContent = text;
    h.classList.toggle("is-error", error);
  }

  // ---------- laudos ----------

  fillCollapse(v: Verdict): void {
    el("fail-fs").textContent = v.fs.toFixed(2);
    el("fail-mode").textContent = v.mode;
    el("fail-list").innerHTML = v.details.map((d) => `<li>${d}</li>`).join("");
  }

  fillReport(v: Verdict, costs: CostBreakdown, hasNext: boolean): void {
    const labels = ["REPROVADO", "APROVADO", "DENTRO DO TETO", "SOLUÇÃO ELEGANTE"];
    el("rep-title").textContent = `RELATÓRIO DE ENSAIO — ${labels[v.stars]}`;
    el("rep-stars").innerHTML = [1, 2, 3]
      .map((i) => `<span class="star ${i <= v.stars ? "is-on" : ""}">★</span>`)
      .join("");
    el("rep-material").textContent = brl(costs.material);
    el("rep-foundations").textContent = brl(costs.foundations);
    el("rep-labor").textContent = brl(costs.labor);
    el("rep-spent").textContent = brl(costs.total);
    el("rep-budget").textContent = brl(v.budget);
    if (Number.isFinite(v.budget)) {
      const delta = costs.total - v.budget;
      el("rep-delta").textContent = `${delta >= 0 ? "+" : ""}${brl(delta)}`;
      el("rep-delta").className = delta > 0 ? "is-bad" : "is-ok";
    } else {
      el("rep-delta").textContent = "—";
      el("rep-delta").className = "";
    }
    el("rep-fs").textContent = v.fs.toFixed(2);
    el("rep-flecha").textContent = `${(v.flechaM * 1000).toFixed(0)} mm  (limite ${(v.limitM * 1000).toFixed(0)} mm)`;
    let note = "";
    if (v.stars === 0) note = v.mode;
    else if (v.stars === 1) note = "Aprovado, mas acima do teto: 2ª estrela exige custo dentro do orçamento.";
    else if (v.stars === 2) note = `3ª estrela: FS ≥ ${SAFETY.fsThreeStar.toFixed(2)} ou custo ≤ 80% do teto.`;
    else note = "ART assinada. Obra exemplar.";
    el("rep-note").textContent = note;
    (el("btn-next") as HTMLButtonElement).disabled = !hasNext || v.stars === 0;
  }

  // ---------- sandbox / galeria ----------

  readSandbox(): SandboxOptions {
    const val = (id: string) => (el(id) as HTMLInputElement).value;
    return {
      biome: val("sb-biome") as BiomeId,
      spanM: Number(val("sb-span")),
      vehicle: val("sb-vehicle"),
      loadT: Number(val("sb-load")),
      windKmh: Number(val("sb-wind")),
      tideRiseM: Number(val("sb-tide")),
      piers: (el("sb-piers") as HTMLInputElement).checked,
    };
  }

  fillGallery(progress: Progress, levels: LevelDef[]): void {
    const done = levels.filter((l) => progress.stars(l.id) > 0);
    el("gal-summary").textContent = `${done.length} DE ${levels.length} OBRAS ENTREGUES · ${progress.totalStars()} ESTRELAS`;
    const rows = levels
      .map((l) => {
        const r = progress.record(l.id);
        const s = progress.stars(l.id);
        const cost = r && Number.isFinite(r.bestCost) ? brl(r.bestCost) : "—";
        const fs = r && r.bestFs > 0 ? r.bestFs.toFixed(2) : "—";
        const tries = r ? r.attempts : 0;
        return `<tr><td class="l">${String(l.id).padStart(2, "0")}</td><td class="l">${l.name}</td><td class="l">${BIOMES[l.biome].name}</td><td class="gold">${starText(s)}</td><td>${cost}</td><td>${fs}</td><td>${tries}</td></tr>`;
      })
      .join("");
    el("gal-table").innerHTML =
      `<tr><th>#</th><th>Obra</th><th>Bioma</th><th>★</th><th style="text-align:right">Melhor custo</th><th style="text-align:right">FS</th><th style="text-align:right">Ensaios</th></tr>` + rows;
  }
}

function starText(n: number): string {
  return "★".repeat(n) + "☆".repeat(3 - n);
}

export function el(id: string): HTMLElement {
  const n = document.getElementById(id);
  if (!n) throw new Error(`#${id} missing`);
  return n;
}
