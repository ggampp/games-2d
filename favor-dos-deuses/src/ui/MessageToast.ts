/**
 * Mensagens empilhadas (até 3), cada uma com sua própria duração.
 * Mensagens idênticas em sequência são agrupadas com contador.
 */
export class MessageToast {
  private container: HTMLDivElement;
  private items: { el: HTMLDivElement; text: string; timer: number; count: number }[] = [];
  private readonly max = 3;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "toast-stack";
    overlay.appendChild(this.container);
  }

  show(text: string, duration = 3000): void {
    const last = this.items[this.items.length - 1];
    if (last && last.text === text) {
      last.count++;
      last.el.textContent = `${text}  ×${last.count}`;
      clearTimeout(last.timer);
      last.timer = window.setTimeout(() => this.remove(last.el), duration);
      return;
    }

    const el = document.createElement("div");
    el.className = "message-toast";
    el.textContent = text;
    this.container.appendChild(el);

    const item = { el, text, count: 1, timer: 0 };
    item.timer = window.setTimeout(() => this.remove(el), duration);
    this.items.push(item);

    while (this.items.length > this.max) {
      const old = this.items.shift()!;
      clearTimeout(old.timer);
      old.el.remove();
    }
  }

  private remove(el: HTMLDivElement): void {
    const idx = this.items.findIndex((i) => i.el === el);
    if (idx >= 0) this.items.splice(idx, 1);
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  }

  clear(): void {
    for (const i of this.items) {
      clearTimeout(i.timer);
      i.el.remove();
    }
    this.items = [];
  }
}
