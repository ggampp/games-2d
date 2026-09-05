export interface DialogOption {
  text: string;
  callback: () => void;
}

export interface DialogData {
  speaker: string;
  text: string;
  options?: DialogOption[];
}

export class Dialog {
  private container: HTMLDivElement;
  private speakerEl: HTMLDivElement;
  private textEl: HTMLDivElement;
  private optionsEl: HTMLDivElement;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "dialog-box";
    this.container.style.display = "none";
    this.container.innerHTML = `
      <div class="dialog-speaker"></div>
      <div class="dialog-text"></div>
      <div class="dialog-options"></div>
    `;

    overlay.appendChild(this.container);

    this.speakerEl = this.container.querySelector(".dialog-speaker")!;
    this.textEl = this.container.querySelector(".dialog-text")!;
    this.optionsEl = this.container.querySelector(".dialog-options")!;
  }

  show(data: DialogData): void {
    this.speakerEl.textContent = data.speaker;
    this.textEl.textContent = data.text;

    this.optionsEl.innerHTML = "";
    if (data.options && data.options.length > 0) {
      for (const option of data.options) {
        const btn = document.createElement("button");
        btn.className = "dialog-option";
        btn.textContent = option.text;
        btn.addEventListener("click", () => {
          option.callback();
        });
        this.optionsEl.appendChild(btn);
      }
    }

    this.container.style.display = "block";
  }

  hide(): void {
    this.container.style.display = "none";
  }

  isVisible(): boolean {
    return this.container.style.display !== "none";
  }

  destroy(): void {
    this.container.remove();
  }
}
