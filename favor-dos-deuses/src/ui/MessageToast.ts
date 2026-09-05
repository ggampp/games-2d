export class MessageToast {
  private overlay: HTMLElement;
  private currentToast: HTMLDivElement | null = null;

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
  }

  show(text: string, duration: number = 3000): void {
    if (this.currentToast) {
      this.currentToast.remove();
    }

    const toast = document.createElement("div");
    toast.className = "message-toast";
    toast.textContent = text;
    toast.style.animationDuration = `${duration}ms`;

    this.overlay.appendChild(toast);
    this.currentToast = toast;

    setTimeout(() => {
      if (this.currentToast === toast) {
        toast.remove();
        this.currentToast = null;
      }
    }, duration);
  }

  destroy(): void {
    if (this.currentToast) {
      this.currentToast.remove();
      this.currentToast = null;
    }
  }
}
