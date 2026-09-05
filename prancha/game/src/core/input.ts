import { Vec2 } from "../sim/vec2.ts";

export class Pointer {
  pos = new Vec2();
  /** Posição no instante do clique (o loop pode rodar depois de o ponteiro já ter se movido). */
  pressPos = new Vec2();
  down = false;
  justPressed = false;
  justReleased = false;
  button = 0;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener("pointerdown", (e) => {
      this.sync(e);
      this.pressPos.copy(this.pos);
      this.down = true;
      this.justPressed = true;
      this.button = e.button;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => this.sync(e));
    canvas.addEventListener("pointerup", (e) => {
      this.sync(e);
      this.down = false;
      this.justReleased = true;
    });
    canvas.addEventListener("pointercancel", () => {
      this.down = false;
      this.justReleased = true;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private sync(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this.pos.set((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  }

  endFrame(): void {
    this.justPressed = false;
    this.justReleased = false;
  }
}
