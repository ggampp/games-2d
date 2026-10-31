export interface DialogOption {
  text: string;
  callback: () => void;
}

export interface DialogData {
  speaker: string;
  text: string;
  options?: DialogOption[];
}

/**
 * Caixa de diálogo em DOM. Navegável por teclado:
 * ↑/↓ ou W/S movem, Enter/E/Espaço confirmam, 1-9 escolhem direto, Esc fecha.
 */
export class Dialog {
  private container: HTMLDivElement;
  private speakerEl: HTMLDivElement;
  private textEl: HTMLDivElement;
  private optionsEl: HTMLDivElement;
  private options: DialogOption[] = [];
  private selected = 0;
  private buttons: HTMLButtonElement[] = [];
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(overlay: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "dialog-box";
    this.container.style.display = "none";
    this.container.innerHTML = `
      <div class="dialog-speaker"></div>
      <div class="dialog-text"></div>
      <div class="dialog-options"></div>
      <div class="dialog-hint">↑↓ escolher · Enter confirmar · Esc sair</div>
    `;
    overlay.appendChild(this.container);

    this.speakerEl = this.container.querySelector(".dialog-speaker")!;
    this.textEl = this.container.querySelector(".dialog-text")!;
    this.optionsEl = this.container.querySelector(".dialog-options")!;
  }

  show(data: DialogData): void {
    this.speakerEl.textContent = data.speaker;
    this.textEl.textContent = data.text;
    this.options = data.options ?? [];
    this.selected = 0;
    this.buttons = [];
    this.optionsEl.innerHTML = "";

    this.options.forEach((option, i) => {
      const btn = document.createElement("button");
      btn.className = "dialog-option";
      btn.innerHTML = `<span class="dialog-option-key">${i + 1}</span>${option.text}`;
      btn.addEventListener("click", () => this.choose(i));
      btn.addEventListener("mouseenter", () => this.setSelected(i));
      this.optionsEl.appendChild(btn);
      this.buttons.push(btn);
    });

    this.container.style.display = "block";
    this.container.classList.remove("dialog-in");
    void this.container.offsetWidth;
    this.container.classList.add("dialog-in");
    this.setSelected(0);
    window.addEventListener("keydown", this.keyHandler, true);
  }

  hide(): void {
    this.container.style.display = "none";
    window.removeEventListener("keydown", this.keyHandler, true);
    this.options = [];
  }

  isVisible(): boolean {
    return this.container.style.display !== "none";
  }

  private setSelected(i: number): void {
    this.selected = i;
    this.buttons.forEach((b, j) => b.classList.toggle("selected", j === i));
  }

  private choose(i: number): void {
    const opt = this.options[i];
    if (!opt) return;
    opt.callback();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.isVisible()) return;
    const n = this.options.length;
    if (n === 0) return;
    e.preventDefault();
    e.stopPropagation();

    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        this.setSelected((this.selected - 1 + n) % n);
        break;
      case "ArrowDown":
      case "KeyS":
        this.setSelected((this.selected + 1) % n);
        break;
      case "Enter":
      case "KeyE":
      case "Space":
      case "NumpadEnter":
        if (!e.repeat) this.choose(this.selected);
        break;
      case "Escape":
        this.choose(n - 1);
        break;
      default: {
        const digit = parseInt(e.key, 10);
        if (!isNaN(digit) && digit >= 1 && digit <= n) this.choose(digit - 1);
      }
    }
  }
}
