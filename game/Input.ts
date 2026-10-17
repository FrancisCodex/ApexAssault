/** Keyboard, mouse (pointer lock) and gamepad state with per-frame edges. */
export class Input {
  private keys = new Set<string>();
  private edges = new Set<string>();
  mouse = [false, false, false];
  mouseDX = 0;
  mouseDY = 0;
  pointerLocked = false;
  enabled = false;
  pad: Gamepad | null = null;
  private padPrev: boolean[] = [];
  private padEdges = new Set<number>();
  private el: HTMLElement | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
    if (!this.keys.has(e.code)) this.edges.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onMouseDown = (e: MouseEvent) => {
    if (!this.enabled) return;
    this.mouse[e.button] = true;
    this.edges.add(`Mouse${e.button}`);
    if (!this.pointerLocked && this.el && e.button === 0) this.requestLock();
  };
  private onMouseUp = (e: MouseEvent) => { this.mouse[e.button] = false; };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.enabled || !this.pointerLocked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };
  /** Fired when the browser drops pointer lock (e.g. the player pressed Esc). */
  onUnlock: (() => void) | null = null;
  private onLockChange = () => {
    const was = this.pointerLocked;
    this.pointerLocked = document.pointerLockElement === this.el;
    if (was && !this.pointerLocked) this.onUnlock?.();
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouse = [false, false, false];
  };
  private onContext = (e: Event) => e.preventDefault();

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('contextmenu', this.onContext);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.el?.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('blur', this.onBlur);
    this.el?.removeEventListener('contextmenu', this.onContext);
    document.removeEventListener('pointerlockchange', this.onLockChange);
  }

  requestLock() {
    try {
      const p = this.el?.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch { /* not allowed (e.g. iframe) */ }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Call once per frame before reading. */
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    this.padEdges.clear();
    if (this.pad) {
      this.pad.buttons.forEach((b, i) => {
        if (b.pressed && !this.padPrev[i]) this.padEdges.add(i);
        this.padPrev[i] = b.pressed;
      });
    }
  }

  endFrame() {
    this.edges.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  down(code: string) { return this.keys.has(code); }
  pressed(code: string) { return this.edges.has(code); }
  padDown(i: number) { return !!this.pad?.buttons[i]?.pressed; }
  padPressed(i: number) { return this.padEdges.has(i); }
  padValue(i: number) { return this.pad?.buttons[i]?.value ?? 0; }
  axis(i: number) {
    const v = this.pad?.axes[i] ?? 0;
    return Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88;
  }
  /** -1..1 from two keys. */
  keyAxis(neg: string, pos: string) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
}
