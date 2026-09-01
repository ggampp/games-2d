import type { InputManager } from "../game/input.js";

export class TouchControls {
  private root: HTMLElement;

  constructor(parent: HTMLElement, input: InputManager) {
    this.root = document.createElement("div");
    this.root.className = "touch-pad";
    this.root.innerHTML = `
      <div class="touch-cluster">
        <button class="touch-btn" data-k="up">▲</button>
        <div class="touch-row">
          <button class="touch-btn" data-k="left">◀</button>
          <button class="touch-btn" data-k="down">▼</button>
          <button class="touch-btn" data-k="right">▶</button>
        </div>
      </div>
      <div class="touch-actions">
        <button class="touch-btn touch-spec" data-k="special">SP</button>
        <button class="touch-btn touch-jump" data-k="jump">PULO</button>
        <button class="touch-btn touch-punch" data-k="punch">SOCO</button>
      </div>
    `;
    parent.appendChild(this.root);

    const map: Record<string, (v: boolean) => void> = {
      left: (v) => (input.virtualLeft = v),
      right: (v) => (input.virtualRight = v),
      up: (v) => (input.virtualUp = v),
      down: (v) => (input.virtualDown = v),
      jump: (v) => (input.virtualJump = v),
      punch: (v) => (input.virtualPunch = v),
      special: (v) => (input.virtualSpecial = v),
    };

    this.root.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => {
      const key = el.dataset.k ?? "";
      const fn = map[key];
      if (!fn) return;
      const down = (e: Event) => {
        e.preventDefault();
        fn(true);
        el.classList.add("is-down");
      };
      const up = (e: Event) => {
        e.preventDefault();
        fn(false);
        el.classList.remove("is-down");
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    });
  }

  public destroy(): void {
    this.root.remove();
  }
}
