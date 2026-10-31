import { VH, VW } from "./const";

export type Action =
  | "left"
  | "right"
  | "up"
  | "down"
  | "jump"
  | "shoot"
  | "grenade"
  | "bite"
  | "pause"
  | "mute"
  | "ok";

const MAP: Record<string, Action> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyA: "left",
  KeyD: "right",
  KeyS: "down",
  KeyW: "jump",
  Space: "jump",
  KeyZ: "jump",
  KeyX: "shoot",
  KeyJ: "shoot",
  KeyC: "grenade",
  KeyG: "grenade",
  KeyV: "bite",
  KeyK: "bite",
  KeyF: "bite",
  Escape: "pause",
  KeyP: "pause",
  KeyM: "mute",
  Enter: "ok",
};

export class Input {
  private keys = new Set<Action>();
  private mouse = new Set<Action>();
  private touchBtns = new Set<Action>();
  private cur = new Set<Action>();
  private prev = new Set<Action>();
  private latched = new Set<Action>();
  mouseX = VW / 2;
  mouseY = VH / 2;
  mouseHot = false;
  touch = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.clear);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  setTouch(action: Action, down: boolean): void {
    this.touch = true;
    this.mouseHot = false;
    if (down) this.touchBtns.add(action);
    else this.touchBtns.delete(action);
  }

  held(a: Action): boolean {
    return this.cur.has(a) || this.latched.has(a);
  }

  pressed(a: Action): boolean {
    return this.latched.has(a) || (this.cur.has(a) && !this.prev.has(a));
  }

  consume(): void {
    this.latched.clear();
  }

  beginFrame(): void {
    this.prev = this.cur;
    const next = new Set<Action>();
    for (const a of this.keys) next.add(a);
    for (const a of this.mouse) next.add(a);
    for (const a of this.touchBtns) next.add(a);
    for (const a of this.readPad()) next.add(a);
    this.cur = next;
  }

  private onDown = (e: KeyboardEvent): void => {
    const action = MAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (!this.keys.has(action)) this.latched.add(action);
    this.keys.add(action);
  };

  private onUp = (e: KeyboardEvent): void => {
    const action = MAP[e.code];
    if (!action) return;
    this.keys.delete(action);
  };

  private clear = (): void => {
    this.keys.clear();
    this.mouse.clear();
    this.touchBtns.clear();
    this.latched.clear();
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === "touch") this.touch = true;
    else this.mouseHot = true;
    this.track(e);
    if (e.button === 0) {
      this.latched.add("shoot");
      this.mouse.add("shoot");
    }
    if (e.button === 2) {
      this.latched.add("bite");
      this.mouse.add("bite");
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.button === 0) this.mouse.delete("shoot");
    if (e.button === 2) this.mouse.delete("bite");
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.track(e);
    if (e.pointerType !== "touch") this.mouseHot = true;
  };

  private track(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.mouseX = ((e.clientX - rect.left) / rect.width) * VW;
    this.mouseY = ((e.clientY - rect.top) / rect.height) * VH;
  }

  private readPad(): Action[] {
    const pads = navigator.getGamepads?.();
    if (!pads) return [];
    const out: Action[] = [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (ax < -0.4) out.push("left");
      if (ax > 0.4) out.push("right");
      if (ay < -0.5) out.push("up");
      if (ay > 0.55) out.push("down");
      if (pad.buttons[0]?.pressed) out.push("jump");
      if (pad.buttons[1]?.pressed) out.push("grenade");
      if (pad.buttons[2]?.pressed || pad.buttons[7]?.pressed) out.push("shoot");
      if (pad.buttons[3]?.pressed) out.push("bite");
      if (pad.buttons[9]?.pressed) out.push("pause");
    }
    return out;
  }
}
