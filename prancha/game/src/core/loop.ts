export class FixedLoop {
  private last = performance.now();
  private acc = 0;
  private readonly step: number;
  private readonly maxFrame = 0.25;
  private raf = 0;
  running = false;

  constructor(
    private readonly onUpdate: (dt: number) => void,
    private readonly onRender: (alpha: number) => void,
    hz = 60,
  ) {
    this.step = 1 / hz;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const tick = (now: number) => {
      if (!this.running) return;
      let frame = (now - this.last) / 1000;
      this.last = now;
      if (frame > this.maxFrame) frame = this.maxFrame;
      this.acc += frame;
      while (this.acc >= this.step) {
        this.onUpdate(this.step);
        this.acc -= this.step;
      }
      this.onRender(this.acc / this.step);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
