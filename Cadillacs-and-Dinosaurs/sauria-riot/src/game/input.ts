import Phaser from "phaser";

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpJustPressed: boolean;
  punch: boolean;
  punchJustPressed: boolean;
  special: boolean;
  specialJustPressed: boolean;
}

export class InputManager {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: Record<string, Phaser.Input.Keyboard.Key | undefined> = {};
  public virtualLeft = false;
  public virtualRight = false;
  public virtualUp = false;
  public virtualDown = false;
  public virtualJump = false;
  public virtualPunch = false;
  public virtualSpecial = false;
  private prevJump = false;
  private prevPunch = false;
  private prevSpecial = false;
  private padPrevJump = false;
  private padPrevPunch = false;
  private padPrevSpecial = false;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keys.W = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keys.A = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keys.S = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keys.D = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keys.Z = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
      this.keys.X = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
      this.keys.C = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C);
      this.keys.J = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
      this.keys.K = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
      this.keys.L = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
      this.keys.SPACE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keys.SHIFT = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }
  }

  public getState(): InputState {
    const pad = this.readPad();
    const left = Boolean(this.cursors?.left.isDown || this.keys.A?.isDown || this.virtualLeft || pad.left);
    const right = Boolean(this.cursors?.right.isDown || this.keys.D?.isDown || this.virtualRight || pad.right);
    const up = Boolean(this.cursors?.up.isDown || this.keys.W?.isDown || this.virtualUp || pad.up);
    const down = Boolean(this.cursors?.down.isDown || this.keys.S?.isDown || this.virtualDown || pad.down);

    const jumpRaw = Boolean(this.keys.X?.isDown || this.keys.K?.isDown || this.keys.SPACE?.isDown || this.virtualJump || pad.jump);
    const punchRaw = Boolean(this.keys.Z?.isDown || this.keys.J?.isDown || this.virtualPunch || pad.punch);
    const specialRaw = Boolean(
      this.keys.C?.isDown || this.keys.L?.isDown || this.keys.SHIFT?.isDown || this.virtualSpecial || pad.special,
    );

    const jumpJustPressed = (jumpRaw && !this.prevJump) || pad.jumpJust;
    const punchJustPressed = (punchRaw && !this.prevPunch) || pad.punchJust;
    const specialJustPressed = (specialRaw && !this.prevSpecial) || pad.specialJust;

    this.prevJump = jumpRaw;
    this.prevPunch = punchRaw;
    this.prevSpecial = specialRaw;

    return {
      left,
      right,
      up,
      down,
      jump: jumpRaw,
      jumpJustPressed,
      punch: punchRaw,
      punchJustPressed,
      special: specialRaw,
      specialJustPressed,
    };
  }

  private readPad(): {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    jump: boolean;
    punch: boolean;
    special: boolean;
    jumpJust: boolean;
    punchJust: boolean;
    specialJust: boolean;
  } {
    const empty = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      punch: false,
      special: false,
      jumpJust: false,
      punchJust: false,
      specialJust: false,
    };
    const pads = navigator.getGamepads?.() ?? [];
    const g = pads.find((p) => p);
    if (!g) {
      this.padPrevJump = false;
      this.padPrevPunch = false;
      this.padPrevSpecial = false;
      return empty;
    }
    const ax = g.axes[0] ?? 0;
    const ay = g.axes[1] ?? 0;
    const punch = Boolean(g.buttons[0]?.pressed);
    const jump = Boolean(g.buttons[1]?.pressed || g.buttons[2]?.pressed);
    const special = Boolean(g.buttons[3]?.pressed || g.buttons[5]?.pressed);
    const jumpJust = jump && !this.padPrevJump;
    const punchJust = punch && !this.padPrevPunch;
    const specialJust = special && !this.padPrevSpecial;
    this.padPrevJump = jump;
    this.padPrevPunch = punch;
    this.padPrevSpecial = special;
    return {
      left: ax < -0.35 || Boolean(g.buttons[14]?.pressed),
      right: ax > 0.35 || Boolean(g.buttons[15]?.pressed),
      up: ay < -0.35 || Boolean(g.buttons[12]?.pressed),
      down: ay > 0.35 || Boolean(g.buttons[13]?.pressed),
      jump,
      punch,
      special,
      jumpJust,
      punchJust,
      specialJust,
    };
  }
}
