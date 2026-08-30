import { UI } from "../data/kit.ts";

export class EndScreen {
  private container: HTMLElement;

  constructor(parent: HTMLElement, onRetry: () => void, onTitle: () => void) {
    this.container = document.createElement("div");
    this.container.className = "interactive end-screen";
    this.container.hidden = true;
    this.container.innerHTML = `
      <div class="end-panel">
        <img class="end-frame" id="end-art" alt="" />
        <div class="end-copy">
          <p id="end-sub"></p>
          <div class="end-actions">
            <button type="button" id="end-retry">Jogar de novo</button>
            <button type="button" id="end-title-btn" class="ghost">Título</button>
          </div>
        </div>
      </div>
    `;
    parent.appendChild(this.container);
    this.container.querySelector("#end-retry")!.addEventListener("click", onRetry);
    this.container.querySelector("#end-title-btn")!.addEventListener("click", onTitle);
  }

  show(won: boolean, coins: number, hp: number): void {
    this.container.hidden = false;
    const art = this.container.querySelector("#end-art") as HTMLImageElement;
    art.src = won ? UI.win : UI.lose;
    this.container.querySelector("#end-sub")!.textContent = won
      ? `Ondas limpas. Moedas ${coins} · Muro ${hp}`
      : "Os zumbis derrubaram o muro. Upe os gatos ou repare.";
  }

  hide(): void {
    this.container.hidden = true;
  }
}
