// On-screen touch controller with haptic feedback for mobile devices

export class TouchControls {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.keysDown = {};
    this.initTouchEvents();
  }

  vibrate(ms = 15) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  }

  bindButton(id, onDown, onUp) {
    const btn = document.getElementById(id);
    if (!btn) return;

    const handleDown = (e) => {
      e.preventDefault();
      btn.classList.add('active');
      this.vibrate(18);
      if (onDown) onDown();
    };

    const handleUp = (e) => {
      e.preventDefault();
      btn.classList.remove('active');
      if (onUp) onUp();
    };

    btn.addEventListener('touchstart', handleDown, { passive: false });
    btn.addEventListener('touchend', handleUp, { passive: false });
    btn.addEventListener('touchcancel', handleUp, { passive: false });
    btn.addEventListener('mousedown', handleDown);
    btn.addEventListener('mouseup', handleUp);
    btn.addEventListener('mouseleave', handleUp);
  }

  initTouchEvents() {
    // Left
    this.bindButton(
      'btn-left',
      () => {
        this.keysDown['ArrowLeft'] = true;
        if (this.callbacks.onLeft) this.callbacks.onLeft();
      },
      () => {
        this.keysDown['ArrowLeft'] = false;
      }
    );

    // Right
    this.bindButton(
      'btn-right',
      () => {
        this.keysDown['ArrowRight'] = true;
        if (this.callbacks.onRight) this.callbacks.onRight();
      },
      () => {
        this.keysDown['ArrowRight'] = false;
      }
    );

    // Soft Drop
    this.bindButton(
      'btn-down',
      () => {
        this.keysDown['ArrowDown'] = true;
        if (this.callbacks.onDown) this.callbacks.onDown();
      },
      () => {
        this.keysDown['ArrowDown'] = false;
      }
    );

    // Rotate Clockwise
    this.bindButton(
      'btn-rotate-cw',
      () => {
        if (this.callbacks.onRotateCW) this.callbacks.onRotateCW();
      },
      null
    );

    // Rotate Counter-Clockwise
    this.bindButton(
      'btn-rotate-ccw',
      () => {
        if (this.callbacks.onRotateCCW) this.callbacks.onRotateCCW();
      },
      null
    );

    // Hard Drop
    this.bindButton(
      'btn-hard-drop',
      () => {
        if (this.callbacks.onHardDrop) this.callbacks.onHardDrop();
      },
      null
    );

    // Hold
    this.bindButton(
      'btn-hold',
      () => {
        if (this.callbacks.onHold) this.callbacks.onHold();
      },
      null
    );
  }

  getKeysDown() {
    return this.keysDown;
  }
}
