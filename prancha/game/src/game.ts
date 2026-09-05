import { Sound } from "./audio/sound.ts";
import { Pointer } from "./core/input.ts";
import { FixedLoop } from "./core/loop.ts";
import { BIOMES, getLevel, LEVELS, makeSandboxLevel, type LevelDef } from "./levels/catalog.ts";
import { AssetBank } from "./render/assets.ts";
import { Particles } from "./render/particles.ts";
import { WorldRenderer, type Preview } from "./render/world.ts";
import { BridgeSystem, type Design } from "./sim/bridge.ts";
import { makeLayout, VIEW_H, VIEW_W, type BiomeId } from "./sim/layout.ts";
import { LoadCase } from "./sim/loadcase.ts";
import { MATERIAL_ORDER, MATERIALS, type MaterialId } from "./sim/materials.ts";
import type { Member } from "./sim/member.ts";
import type { SimNode } from "./sim/node.ts";
import { evaluate, type Outcome, type Verdict } from "./sim/scoring.ts";
import { Vehicle } from "./sim/vehicle.ts";
import { Progress } from "./state/progress.ts";
import { el, Hud, type ScreenId } from "./ui/hud.ts";

const MAX_ID = LEVELS[LEVELS.length - 1].id;

export class Game {
  private readonly assets = new AssetBank();
  private readonly hud = new Hud();
  private readonly sound = new Sound();
  private readonly particles = new Particles();
  private readonly progress = new Progress();
  private readonly pointer: Pointer;
  private readonly renderer: WorldRenderer;
  private readonly loop: FixedLoop;

  private screen: ScreenId = "menu";
  private mode: "build" | "test" = "build";
  private level: LevelDef = LEVELS[0];
  private bridge: BridgeSystem;
  private loads: LoadCase;
  private vehicles: Vehicle[] = [];
  private material: MaterialId = "wood";
  private dragFrom: SimNode | null = null;
  private dragCreated = false;
  private hoverNode: SimNode | null = null;
  private hoverMember: Member | null = null;
  private undoStack: Design[] = [];
  private tutorialStep = 0;
  private hitstop = 0;
  private shake = 0;
  private settle = 0;
  private pendingOutcome: Outcome | null = null;
  private lastVerdict: Verdict | null = null;
  private time = 0;
  private cadernoBiome: BiomeId = "plains";

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.pointer = new Pointer(canvas);
    this.renderer = new WorldRenderer(canvas, this.assets);
    this.loop = new FixedLoop((dt) => this.update(dt), () => this.draw());
    const layout = makeLayout(this.level.spanM, this.level.biome);
    this.bridge = new BridgeSystem(layout, this.level.mods);
    this.loads = new LoadCase(this.level.mods, layout);
    this.sound.setMuted(this.progress.data.muted);
    this.hud.setMuted(this.progress.data.muted);
    this.bindUi();
  }

  async start(): Promise<void> {
    await this.assets.load();
    this.hud.fillMenu(this.progress, MAX_ID);
    this.hud.show("menu");
    this.loop.start();
  }

  // ---------- navegação ----------

  private bindUi(): void {
    const on = (id: string, fn: () => void) => el(id).addEventListener("click", fn);
    on("btn-mute", () => this.toggleMute());
    on("btn-new", () => {
      this.click();
      this.openCaderno();
    });
    on("btn-continue", () => {
      this.click();
      const id = this.progress.data.lastLevel || this.progress.nextOpen(MAX_ID);
      this.openBriefing(getLevel(this.progress.isUnlocked(id) ? id : this.progress.nextOpen(MAX_ID)) ?? LEVELS[0]);
    });
    on("btn-sandbox", () => {
      this.click();
      this.go("sandbox");
    });
    on("btn-gallery", () => {
      this.click();
      this.hud.fillGallery(this.progress, LEVELS);
      this.go("gallery");
    });
    on("btn-caderno-back", () => this.go("menu"));
    on("btn-back-menu", () => (this.level.id === 0 ? this.go("sandbox") : this.openCaderno()));
    on("btn-start-project", () => {
      this.click();
      this.enterPlay();
    });
    on("btn-sb-back", () => this.go("menu"));
    on("btn-sb-start", () => {
      this.click();
      this.openBriefing(makeSandboxLevel(this.hud.readSandbox()));
    });
    on("btn-gal-back", () => this.go("menu"));
    on("btn-gal-reset", () => {
      if (confirm("Apagar todo o progresso e os projetos salvos?")) {
        this.progress.reset();
        this.hud.fillGallery(this.progress, LEVELS);
        this.hud.fillMenu(this.progress, MAX_ID);
      }
    });

    on("btn-test", () => this.startTest());
    on("btn-pause", () => this.resetToBuild());
    on("btn-restart-test", () => this.startTest());
    on("btn-undo", () => this.undo());
    on("btn-clear", () => this.clearBridge());
    on("btn-exit", () => this.exitToCaderno());

    on("btn-fail-retry", () => this.resetToBuild());
    on("btn-fail-report", () => this.showReport());
    on("btn-revistar", () => this.resetToBuild());
    on("btn-rep-caderno", () => this.exitToCaderno());
    on("btn-next", () => {
      const next = getLevel(this.level.id + 1);
      if (next) this.openBriefing(next);
      else this.openCaderno();
    });

    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "SELECT") return;
    if (e.key === "m" || e.key === "M") this.toggleMute();
    if (this.screen !== "play") {
      if (e.key === "Escape" && this.screen !== "menu") this.go("menu");
      return;
    }
    if (e.key === "Escape") {
      if (this.dragFrom) this.cancelDrag();
      else if (this.mode === "test") this.resetToBuild();
      else this.exitToCaderno();
    }
    if (e.key === "t" || e.key === "T") this.startTest();
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      this.undo();
    }
    if (e.key === "Delete" && this.hoverMember) this.removeMember(this.hoverMember);
    const n = Number(e.key);
    if (n >= 1 && n <= MATERIAL_ORDER.length) this.pickMaterial(MATERIAL_ORDER[n - 1]);
  }

  private click(): void {
    this.sound.click();
  }

  private toggleMute(): void {
    const m = !this.sound.muted;
    this.sound.ensure();
    this.sound.setMuted(m);
    this.hud.setMuted(m);
    this.progress.setMuted(m);
  }

  private go(id: ScreenId): void {
    this.screen = id;
    this.hud.show(id);
    if (id === "menu") this.hud.fillMenu(this.progress, MAX_ID);
  }

  private openCaderno(biome?: BiomeId): void {
    if (biome) this.cadernoBiome = biome;
    else if (this.level.id > 0) this.cadernoBiome = this.level.biome;
    this.hud.fillCaderno(
      this.cadernoBiome,
      this.progress,
      (b) => {
        this.click();
        this.openCaderno(b);
      },
      (id) => {
        this.click();
        const lvl = getLevel(id);
        if (lvl) this.openBriefing(lvl);
      },
    );
    this.go("caderno");
  }

  private openBriefing(level: LevelDef): void {
    this.level = level;
    this.hud.fillBriefing(level, !!this.progress.design(level.id));
    this.go("briefing");
  }

  private exitToCaderno(): void {
    this.sound.stopAll();
    if (this.mode === "build" && this.level.id > 0) this.progress.saveDesign(this.level.id, this.bridge.serialize());
    this.mode = "build";
    if (this.level.id === 0) this.go("sandbox");
    else this.openCaderno();
  }

  // ---------- sessão de obra ----------

  private enterPlay(): void {
    const layout = makeLayout(this.level.spanM, this.level.biome);
    this.bridge = new BridgeSystem(layout, this.level.mods);
    this.loads = new LoadCase(this.level.mods, layout);
    this.bridge.onBeamBreak = (beam) => {
      const mx = (beam.nodeA.pos.x + beam.nodeB.pos.x) / 2;
      const my = (beam.nodeA.pos.y + beam.nodeB.pos.y) / 2;
      this.particles.snap(mx, my, beam.material.color);
      this.sound.snap();
      this.hitstop = 0.04;
      this.shake = Math.max(this.shake, 0.55);
    };
    const saved = this.progress.design(this.level.id);
    if (saved) this.bridge.load(saved);
    this.material = this.level.catalog[0];
    this.buildVehicles();
    this.mode = "build";
    this.undoStack = [];
    this.tutorialStep = this.level.tutorial && this.bridge.members.length === 0 ? 1 : 0;
    this.pendingOutcome = null;
    this.lastVerdict = null;
    this.dragFrom = null;
    this.hud.bindToolbox(this.level.catalog, this.material, (id) => this.pickMaterial(id));
    this.hud.setQuota(this.level, (id) => this.bridge.usedM(id));
    this.go("play");
    this.refreshHud();
  }

  private buildVehicles(): void {
    const runs = this.level.mods.vehicles ?? [
      { id: this.level.vehicle, loadT: this.level.loadT, dir: 1 as const, delay: 0 },
    ];
    this.vehicles = runs.map((r) => new Vehicle(r.id, r.loadT, r.dir, r.delay, this.bridge.layout));
  }

  private pickMaterial(id: MaterialId): void {
    if (!this.level.catalog.includes(id)) return;
    this.material = id;
    this.hud.setActiveTool(id);
    this.click();
  }

  private pushUndo(): void {
    this.undoStack.push(this.bridge.serialize());
    if (this.undoStack.length > 80) this.undoStack.shift();
  }

  private undo(): void {
    if (this.mode !== "build") return;
    const d = this.undoStack.pop();
    if (!d) {
      this.sound.deny();
      return;
    }
    this.bridge.load(d);
    this.afterEdit();
    this.click();
  }

  private clearBridge(): void {
    if (this.mode !== "build" || this.bridge.members.every((m) => m.locked)) return;
    this.pushUndo();
    this.bridge.clear();
    this.tutorialStep = this.level.tutorial ? 1 : 0;
    this.afterEdit();
    this.click();
  }

  private removeMember(m: Member): void {
    if (this.mode !== "build") return;
    if (m.locked) {
      this.hud.setHint("Estrutura tombada pelo patrimônio: não pode ser demolida.", true);
      this.sound.deny();
      return;
    }
    this.pushUndo();
    this.bridge.removeMember(m);
    this.afterEdit();
    this.click();
  }

  private afterEdit(): void {
    this.hoverMember = null;
    this.hoverNode = null;
    this.hud.setQuota(this.level, (id) => this.bridge.usedM(id));
    this.refreshHud();
  }

  private cancelDrag(): void {
    if (this.dragFrom && this.dragCreated) {
      this.bridge.cleanupOrphans();
    }
    this.dragFrom = null;
    this.dragCreated = false;
  }

  // ---------- ensaio ----------

  private startTest(): void {
    if (this.screen !== "play") return;
    if (this.bridge.members.every((m) => m.locked)) {
      this.hud.setHint("Ligue os encontros antes do ensaio.", true);
      this.sound.deny();
      return;
    }
    this.cancelDrag();
    if (this.level.id > 0) {
      this.progress.saveDesign(this.level.id, this.bridge.serialize());
      this.progress.registerAttempt(this.level.id);
    }
    this.sound.stamp();
    this.bridge.resetPhysics();
    this.loads.reset();
    this.buildVehicles();
    this.particles.clear();
    this.pendingOutcome = null;
    this.mode = "test";
    this.bridge.presettle(this.loads);
    this.settle = 0;
    this.refreshHud();
  }

  private resetToBuild(): void {
    this.sound.stopAll();
    this.bridge.resetPhysics();
    this.buildVehicles();
    this.particles.clear();
    this.mode = "build";
    this.pendingOutcome = null;
    this.go("play");
    this.refreshHud();
  }

  private finishTest(outcome: Outcome): void {
    this.sound.stopAll();
    const v = evaluate(this.bridge, this.level, this.vehicles, outcome);
    this.lastVerdict = v;
    if (this.level.id > 0) this.progress.registerResult(this.level.id, v.stars, v.cost, v.fs);
    if (!v.pass) {
      this.hud.fillCollapse(v);
      this.sound.stamp();
      this.go("collapse");
      return;
    }
    this.showReport();
  }

  private showReport(): void {
    const v = this.lastVerdict ?? evaluate(this.bridge, this.level, this.vehicles, "crossed");
    const hasNext = this.level.id > 0 && !!getLevel(this.level.id + 1);
    this.hud.fillReport(v, this.bridge.costs(), hasNext);
    if (v.pass) this.sound.approve();
    else this.sound.stamp();
    this.go("report");
  }

  // ---------- loop ----------

  private update(dt: number): void {
    this.time += dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.particles.update(dt);
      this.shake = Math.max(0, this.shake - dt * 2.2);
      this.pointer.endFrame();
      return;
    }

    if (this.screen === "play") {
      this.handleBuildInput();
      if (this.mode === "test") this.updateTest(dt);
      this.refreshHud();
    }

    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.pointer.endFrame();
  }

  private updateTest(dt: number): void {
    const layout = this.bridge.layout;
    this.loads.update(dt);
    const road = this.bridge.roadBeams();
    for (const v of this.vehicles) v.update(dt, road, layout, this.loads.waterY, this.loads.trafficReleased);
    this.bridge.update(dt, this.loads, this.vehicles.flatMap((v) => v.loads));

    const moving = this.vehicles.find((v) => v.active && !v.hasFinished && !v.hasFallen);
    this.sound.setEngine(!!moving, moving ? moving.vel.x : 0);
    this.sound.setStress(this.bridge.maxStress);
    const windKmh = this.level.mods.windKmh ?? 0;
    if (windKmh > 0) {
      const strength = Math.min(1, this.loads.windNow / (windKmh * windKmh * 0.035 * 1.5));
      this.sound.setWind(strength);
      this.particles.wind(layout.width, layout.topY - 40, this.loads.waterY, strength);
    }

    for (const v of this.vehicles) {
      if (!v.splashed && v.pos.y > this.loads.waterY) {
        v.splashed = true;
        this.particles.splash(v.pos.x, this.loads.waterY);
        this.sound.splash();
      }
    }

    if (!this.pendingOutcome) {
      if (this.vehicles.some((v) => v.hasFallen)) {
        this.pendingOutcome = "fell";
        this.settle = 0.5;
        this.shake = 0.9;
      } else if (this.vehicles.some((v) => v.stuckTime > 4)) {
        this.pendingOutcome = "stuck";
        this.settle = 0.4;
      } else if (this.vehicles.every((v) => v.hasFinished)) {
        this.pendingOutcome = "crossed";
        this.settle = 0.6;
      } else if (this.bridge.simTime > 60) {
        this.pendingOutcome = "stuck";
        this.settle = 0;
      }
    }
    if (this.pendingOutcome) {
      this.settle -= dt;
      if (this.settle <= 0) this.finishTest(this.pendingOutcome);
    }
  }

  // ---------- construção ----------

  private handleBuildInput(): void {
    if (this.mode !== "build") {
      this.dragFrom = null;
      this.hoverNode = null;
      this.hoverMember = null;
      return;
    }
    const { x, y } = this.pointer.pos;
    this.hoverNode = this.bridge.findNodeNear(x, y, 22);
    this.hoverMember = this.hoverNode ? null : this.bridge.findMemberNear(x, y, 14);

    if (this.pointer.justPressed && this.pointer.button === 2) {
      if (this.dragFrom) this.cancelDrag();
      else if (this.hoverMember) this.removeMember(this.hoverMember);
      return;
    }

    if (this.pointer.justPressed && this.pointer.button === 0) {
      const px = this.pointer.pressPos.x;
      const py = this.pointer.pressPos.y;
      const before = this.bridge.nodes.length;
      const start = this.bridge.placePoint(px, py);
      if (start) {
        this.dragFrom = start;
        this.dragCreated = this.bridge.nodes.length > before;
        this.click();
      } else if (!this.bridge.inBuildEnvelope(px, py)) {
        this.hud.setHint("Fora da envoltória de construção (linha tracejada).", true);
      }
    }

    if (this.pointer.justReleased && this.dragFrom) {
      const from = this.dragFrom;
      const snapshot = this.bridge.serialize();
      const end = this.bridge.placePoint(x, y);
      if (end && end !== from) {
        const r = this.bridge.addMember(from, end, this.material);
        if (!r.ok) {
          this.bridge.cleanupOrphans();
          this.hud.setHint(r.error, true);
          this.sound.deny();
        } else {
          this.undoStack.push(snapshot);
          if (this.undoStack.length > 80) this.undoStack.shift();
          if (this.tutorialStep === 1) this.tutorialStep = 2;
          this.click();
          this.afterEdit();
        }
      } else {
        this.bridge.cleanupOrphans();
      }
      this.dragFrom = null;
      this.dragCreated = false;
    }
  }

  private previewState(): Preview | null {
    if (!this.dragFrom) return null;
    const { x, y } = this.pointer.pos;
    const target = this.bridge.findNodeNear(x, y, 22);
    const s = target ? { x: target.pos.x, y: target.pos.y } : this.bridge.snap(x, y);
    const meters = Math.hypot(s.x - this.dragFrom.pos.x, s.y - this.dragFrom.pos.y) / this.bridge.layout.ppm;
    const mat = MATERIALS[this.material];
    let note: string | undefined;
    let valid = true;
    if (meters > mat.maxLengthM + 0.05) {
      valid = false;
      note = `máx ${mat.maxLengthM} m`;
    } else if (!target && !this.bridge.inBuildEnvelope(x, y)) {
      valid = false;
      note = "fora da envoltória";
    } else if (this.bridge.inZone(s.x, s.y)) {
      valid = false;
      note = "gabarito";
    } else {
      const quota = this.level.mods.quotaM?.[this.material];
      if (quota !== undefined && this.bridge.usedM(this.material) + meters > quota) {
        valid = false;
        note = "sem material";
      }
    }
    if (valid) {
      const cost = mat.unitCost ?? meters * mat.costPerMeter * 1.18;
      note = `+${cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`;
      if (this.bridge.snap(x, y).bed && !target) note += " + fundação";
    }
    return { ax: this.dragFrom.pos.x, ay: this.dragFrom.pos.y, bx: s.x, by: s.y, color: mat.color, meters, valid, note };
  }

  private refreshHud(): void {
    if (this.screen !== "play") return;
    const testing = this.mode === "test";
    this.hud.fillPlay({
      level: this.level,
      costs: this.bridge.costs(),
      fs: testing ? this.bridge.factorOfSafety() : null,
      testing,
      windKmh: this.level.mods.windKmh ?? 0,
      windNow: this.loads.windNow,
      phase: testing ? this.loads.phaseLabel() : null,
    });
    if (testing) {
      this.hud.setHint("Ensaio em andamento. Verde ok · amarelo atenção · vermelho ruptura.");
      return;
    }
    if (this.hud && el("hud-hint").classList.contains("is-error") && this.pointer.down) return;
    if (this.tutorialStep === 1 && this.level.id === 1) {
      this.hud.setHint("O vão não perdoa. Clique o nó dourado do encontro esquerdo e arraste até o direito, numa peça só.");
    } else if (this.tutorialStep === 2 && this.level.id === 1) {
      this.hud.setHint("Peça no lugar. TESTAR CARGA (T): a estrutura vai falar em cores.");
    } else if (this.level.id === 2 && this.tutorialStep >= 1) {
      this.hud.setHint("Tabuleiro reto não segura 8 t. Erga uma treliça: peças curtas unidas nos nós, acima do tabuleiro.");
    } else if (this.level.id === 3 && this.tutorialStep >= 1) {
      this.hud.setHint("Cabo só trabalha à tração: um mastro em madeira e tirantes de cabo até o tabuleiro.");
    } else if (!this.pointer.down) {
      this.hud.setHint(this.buildHint());
    }
  }

  private buildHint(): string {
    const m = this.level.mods;
    if (m.piers && m.piers !== "forbidden") return "Arraste entre nós. Toque a linha do leito para fundar um pilar (custo por fundação).";
    if (m.clearance) return "Nada pode invadir a zona hachurada do gabarito. Pense em arco ou treliça acima do tabuleiro.";
    if (m.windKmh) return `Vento de ${m.windKmh} km/h empurra a estrutura: triangule e ancore nos apoios baixos.`;
    if (m.prebuilt?.length) return "Peças douradas são patrimônio tombado: use-as, não demola.";
    return `Arraste entre nós · botão direito apaga · grade ${this.bridge.layout.snapM.toFixed(2).replace(".", ",")} m.`;
  }

  private draw(): void {
    const mag = this.shake;
    this.renderer.render({
      bridge: this.bridge,
      vehicles: this.vehicles,
      particles: this.particles,
      mode: this.mode,
      preview: this.previewState(),
      hoverNode: this.hoverNode,
      hoverMember: this.hoverMember,
      shake: {
        x: mag ? (Math.random() - 0.5) * 14 * mag : 0,
        y: mag ? (Math.random() - 0.5) * 10 * mag : 0,
      },
      biome: BIOMES[this.level.biome],
      waterY: this.mode === "test" ? this.loads.waterY : this.bridge.layout.waterY,
      time: this.time,
    });
  }
}
