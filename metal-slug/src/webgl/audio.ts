export class Sfx {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private music: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  muted = false;

  async load(names: string[]): Promise<void> {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    await Promise.all(
      names.map(async (name) => {
        try {
          const res = await fetch(`/audio/${name}.mp3`);
          if (!res.ok) return;
          const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(name, buf);
        } catch {
          /* o jogo segue sem esse som */
        }
      }),
    );
  }

  unlock(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  play(name: string, volume = 1): void {
    if (this.muted || !this.ctx) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    this.unlock();
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  startMusic(): void {
    if (!this.ctx || this.music) return;
    const buf = this.buffers.get("music");
    if (!buf) return;
    this.unlock();
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = this.muted ? 0 : 0.22;
    src.buffer = buf;
    src.loop = true;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
    this.music = src;
    this.musicGain = gain;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.musicGain) this.musicGain.gain.value = muted ? 0 : 0.22;
  }
}
