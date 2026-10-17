import * as THREE from 'three';
import type { GameContext, Combatant } from './core/context';
import type { PlayerController } from './PlayerController';
import type { CameraMode } from './data/types';
import type { HudStat } from './missions/Mission';
import type { GroundTarget } from './entities/GroundTarget';
import { GROUND_LABEL } from './entities/GroundTarget';
import { clamp, DEG, headingOf, formatTime } from './core/utils';
import { MAP } from './world/layout';
import { WEAPONS } from './data/weapons';

const GREEN = '#8dffb6';
const GREEN_DIM = 'rgba(141,255,182,0.55)';
const RED = '#ff4b4b';
const ORANGE = '#ffb347';
const BLUE = '#6cb6ff';
const WHITE = '#f4f7f5';

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

interface Notice { text: string; color: string; t: number }

/** Ace Combat style 2D HUD drawn on a canvas over the WebGL view. */
export class HUD {
  private ctx2d: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private notices: Notice[] = [];
  private blink = 0;
  showMap = false;
  hitMarker = 0;
  damageFlash = 0;
  cloud = 0;
  missileWarn = false;
  lockWarn = false;
  private mapImage: HTMLCanvasElement | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx2d = canvas.getContext('2d')!;
  }

  setMapImage(img: HTMLCanvasElement) { this.mapImage = img; }

  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  notify(text: string, color = ORANGE) {
    this.notices.unshift({ text, color, t: 1.6 });
    if (this.notices.length > 3) this.notices.pop();
  }

  clear() {
    this.ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private project(world: THREE.Vector3, cam: THREE.Camera, out: { x: number; y: number; behind: boolean }) {
    _p.copy(world).applyMatrix4(cam.matrixWorldInverse);
    out.behind = _p.z > 0;
    _p.applyMatrix4((cam as THREE.PerspectiveCamera).projectionMatrix);
    out.x = (_p.x * 0.5 + 0.5) * this.w;
    out.y = (-_p.y * 0.5 + 0.5) * this.h;
    return out;
  }

  draw(dt: number, game: GameContext, pc: PlayerController, camMode: CameraMode, stats: HudStat[], score: number, mouseAim: boolean) {
    const c = this.ctx2d;
    const ac = pc.ac;
    const cam = game.camera;
    this.blink += dt;
    this.clear();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.lineJoin = 'round';
    c.font = '600 13px "Rajdhani", "Segoe UI", system-ui, sans-serif';
    const blinkOn = Math.floor(this.blink * 4) % 2 === 0;

    // Whiteout inside clouds.
    if (this.cloud > 0.01) {
      c.fillStyle = `rgba(235,238,242,${Math.min(0.85, this.cloud * 1.1)})`;
      c.fillRect(0, 0, this.w, this.h);
    }
    // Damage flash & low health vignette.
    const hpFrac = ac.hp / ac.maxHp;
    if (this.damageFlash > 0 || hpFrac < 0.3) {
      const a = Math.max(this.damageFlash * 0.6, hpFrac < 0.3 ? (0.25 + Math.sin(this.blink * 6) * 0.1) * (1 - hpFrac / 0.3) : 0);
      const g = c.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.25, this.w / 2, this.h / 2, this.h * 0.85);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(200,0,0,${a})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.h);
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2);
    }
    if (!ac.alive) return;

    const cx = this.w / 2, cy = this.h / 2;
    c.strokeStyle = GREEN;
    c.fillStyle = GREEN;
    c.lineWidth = 1.5;
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 3;

    const scr = { x: 0, y: 0, behind: false };
    ac.forward(_fwd);

    // --- Pitch ladder & horizon (cockpit / HUD views) ---
    if (camMode === 'COCKPIT' || camMode === 'HUD') this.drawLadder(c, cam, ac.position, _fwd, scr);

    // --- Boresight (nose) and flight path marker ---
    _v.copy(ac.position).addScaledVector(_fwd, 1500);
    this.project(_v, cam, scr);
    if (!scr.behind) this.drawBoresight(c, scr.x, scr.y);
    if (ac.speed > 5 && !ac.isHeli) {
      _v.copy(ac.velocity).normalize().multiplyScalar(1500).add(ac.position);
      this.project(_v, cam, scr);
      if (!scr.behind) this.drawFPM(c, scr.x, scr.y);
    }
    if (mouseAim) {
      _v.copy(ac.position).addScaledVector(pc.aimDir, 1500);
      this.project(_v, cam, scr);
      if (!scr.behind) {
        c.strokeStyle = WHITE;
        c.beginPath(); c.arc(scr.x, scr.y, 9, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = GREEN;
      }
    }

    // --- Special weapon seeker circle ---
    const w = pc.weapon;
    if (pc.weaponSlot === 'SP' && w.guided && !w.drop) {
      const r = (Math.tan(w.lockCone * DEG) / Math.tan((cam.fov * DEG) / 2)) * (this.h / 2);
      _v.copy(ac.position).addScaledVector(_fwd, 1500);
      this.project(_v, cam, scr);
      if (!scr.behind && r < this.h) {
        c.strokeStyle = GREEN_DIM;
        c.setLineDash([6, 6]);
        c.beginPath(); c.arc(scr.x, scr.y, r, 0, Math.PI * 2); c.stroke();
        c.setLineDash([]);
        c.strokeStyle = GREEN;
      }
    }

    // --- Targets ---
    this.drawTargets(c, game, pc, cam, scr);

    // --- Gun pipper ---
    if (pc.gunLeadValid && pc.target) {
      this.project(pc.gunLead, cam, scr);
      if (!scr.behind) {
        c.strokeStyle = WHITE;
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(scr.x, scr.y, 14, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(scr.x, scr.y, 2, 0, Math.PI * 2); c.fill();
        const d = pc.target.position.distanceTo(ac.position);
        c.beginPath();
        c.arc(scr.x, scr.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(1 - d / 1500, 0, 1));
        c.stroke();
        c.strokeStyle = GREEN;
      }
    }

    // --- Instruments ---
    this.drawTapes(c, ac, cx, cy);
    this.drawHeading(c, ac, cx);
    this.drawRadar(c, game, pc);
    this.drawWeapons(c, pc, game.time);
    this.drawStats(c, stats, score);

    // --- Warnings ---
    let wy = cy - this.h * 0.24;
    const warn = (text: string, color: string, big = false) => {
      c.font = big ? '700 26px "Rajdhani", system-ui, sans-serif' : '700 18px "Rajdhani", system-ui, sans-serif';
      c.textAlign = 'center';
      const tw = c.measureText(text).width + 24;
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.strokeRect(cx - tw / 2, wy - (big ? 22 : 17), tw, big ? 32 : 25);
      c.fillStyle = color;
      c.fillText(text, cx, wy);
      wy += big ? 40 : 32;
    };
    if (this.missileWarn && blinkOn) warn('MISSILE ALERT', RED, true);
    else if (this.lockWarn && blinkOn) warn('WARNING', RED, true);
    else if (this.missileWarn || this.lockWarn) wy += 40;
    if (ac.stalled && blinkOn) warn('STALL', RED);
    const pullUp = this.pullUp(ac, game);
    if (pullUp && blinkOn) warn('PULL UP', RED);
    const out = Math.max(Math.abs(ac.position.x), Math.abs(ac.position.z)) > MAP.combatHalf;
    if (out) warn('RETURN TO COMBAT AREA', ORANGE);
    if (ac.isHeli && ac.landed) warn('LANDED', GREEN);

    // Missile direction indicators around the reticle.
    for (const m of game.missiles.incoming(ac)) {
      _q.copy(m.pos).sub(ac.position);
      const d = _q.length();
      _q.applyMatrix4(_mInv.copy(cam.matrixWorld).invert().setPosition(0, 0, 0));
      const ang = Math.atan2(_q.x, _q.y);
      const r = 90;
      c.save();
      c.translate(cx + Math.sin(ang) * r, cy - Math.cos(ang) * r);
      c.rotate(ang);
      c.fillStyle = d < 1200 ? RED : ORANGE;
      c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 4); c.lineTo(-8, 4); c.closePath(); c.fill();
      c.restore();
    }

    // Hit / kill notices under the reticle.
    c.textAlign = 'center';
    c.font = '700 20px "Rajdhani", system-ui, sans-serif';
    let ny = cy + 70;
    for (const n of this.notices) {
      n.t -= dt;
      c.globalAlpha = clamp(n.t * 2, 0, 1);
      c.fillStyle = n.color;
      c.fillText(n.text, cx, ny);
      ny += 24;
    }
    c.globalAlpha = 1;
    this.notices = this.notices.filter((n) => n.t > 0);
    if (this.hitMarker > 0) {
      this.hitMarker -= dt;
      c.strokeStyle = WHITE;
      c.lineWidth = 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        c.beginPath(); c.moveTo(cx + sx * 8, cy + sy * 8); c.lineTo(cx + sx * 16, cy + sy * 16); c.stroke();
      }
    }

    if (this.showMap) this.drawMap(c, game, pc);
  }

  private pullUp(ac: { position: THREE.Vector3; velocity: THREE.Vector3; isHeli: boolean; altitude: number }, game: GameContext) {
    if (ac.isHeli || ac.velocity.y > -5) return false;
    for (const t of [1, 2, 3]) {
      _v.copy(ac.position).addScaledVector(ac.velocity, t);
      if (_v.y < game.terrain.getSurface(_v.x, _v.z) + 10) return true;
    }
    return false;
  }

  private drawBoresight(c: CanvasRenderingContext2D, x: number, y: number) {
    c.strokeStyle = GREEN;
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(x - 22, y); c.lineTo(x - 10, y); c.lineTo(x - 5, y + 7); c.lineTo(x, y);
    c.lineTo(x + 5, y + 7); c.lineTo(x + 10, y); c.lineTo(x + 22, y);
    c.stroke();
  }

  private drawFPM(c: CanvasRenderingContext2D, x: number, y: number) {
    c.strokeStyle = GREEN;
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(x - 16, y); c.lineTo(x - 6, y);
    c.moveTo(x + 6, y); c.lineTo(x + 16, y);
    c.moveTo(x, y - 6); c.lineTo(x, y - 12);
    c.stroke();
  }

  private drawLadder(c: CanvasRenderingContext2D, cam: THREE.Camera, pos: THREE.Vector3, fwd: THREE.Vector3, scr: { x: number; y: number; behind: boolean }) {
    const hdg = Math.atan2(fwd.x, -fwd.z);
    const hx = Math.sin(hdg), hz = -Math.cos(hdg);
    _right.set(-hz, 0, hx);
    c.save();
    c.beginPath();
    c.rect(this.w * 0.3, this.h * 0.2, this.w * 0.4, this.h * 0.6);
    c.clip();
    c.font = '600 11px "Rajdhani", system-ui, sans-serif';
    c.textAlign = 'left';
    const a = { x: 0, y: 0, behind: false }, b = { x: 0, y: 0, behind: false };
    for (let deg = -80; deg <= 80; deg += 10) {
      const el = deg * DEG;
      _q.set(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).multiplyScalar(1000).add(pos);
      _v.copy(_q).addScaledVector(_right, deg === 0 ? -260 : -120);
      this.project(_v, cam, a);
      _v.copy(_q).addScaledVector(_right, deg === 0 ? 260 : 120);
      this.project(_v, cam, b);
      if (a.behind || b.behind) continue;
      c.strokeStyle = deg === 0 ? GREEN : GREEN_DIM;
      c.lineWidth = deg === 0 ? 1.6 : 1.2;
      c.setLineDash(deg < 0 ? [8, 6] : []);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const gap = 0.18;
      c.beginPath();
      c.moveTo(a.x, a.y); c.lineTo(a.x + (mx - a.x) * (1 - gap) * 2 * 0.5, a.y + (my - a.y) * (1 - gap));
      c.moveTo(b.x, b.y); c.lineTo(b.x + (mx - b.x) * (1 - gap), b.y + (my - b.y) * (1 - gap));
      c.stroke();
      if (deg !== 0) {
        c.fillStyle = GREEN_DIM;
        c.fillText(`${deg}`, b.x + 5, b.y + 4);
      }
    }
    c.setLineDash([]);
    c.restore();
    void scr;
  }

  private drawTargets(c: CanvasRenderingContext2D, game: GameContext, pc: PlayerController, cam: THREE.Camera, scr: { x: number; y: number; behind: boolean }) {
    const ac = pc.ac;
    const lists: Combatant[][] = [game.aircraft, game.ground];
    c.textAlign = 'center';
    for (const list of lists) {
      for (const t of list) {
        if (!t.alive || t === ac) continue;
        const d = t.position.distanceTo(ac.position);
        const friendly = t.team === ac.team;
        if (!t.isAir && friendly && d > 6000) continue;
        if (d > (t.isAir ? 16000 : 12000)) continue;
        this.project(t.position, cam, scr);
        if (scr.behind) continue;
        if (scr.x < -40 || scr.x > this.w + 40 || scr.y < -40 || scr.y > this.h + 40) continue;
        const isTarget = t === pc.target;
        const col = friendly ? BLUE : t.isAir ? RED : ORANGE;
        const size = clamp(2600 / Math.max(d, 1), 7, 26);
        c.strokeStyle = col;
        c.fillStyle = col;
        c.lineWidth = isTarget ? 2.2 : 1.4;
        if (!t.targetable && !friendly) {
          c.globalAlpha = 0.45;
        }
        if (friendly) {
          c.beginPath(); c.arc(scr.x, scr.y, size * 0.7, 0, Math.PI * 2); c.stroke();
        } else if (t.isAir) {
          this.bracket(c, scr.x, scr.y, size);
        } else {
          c.strokeRect(scr.x - size * 0.8, scr.y - size * 0.8, size * 1.6, size * 1.6);
        }
        c.font = '600 11px "Rajdhani", system-ui, sans-serif';
        if (t.isMissionTarget && !friendly) {
          c.fillText('TGT', scr.x, scr.y - size - 6);
        }
        if (isTarget || d < 2500 || t.isMissionTarget) {
          const label = t.isAir ? t.name.toUpperCase() : GROUND_LABEL[(t as GroundTarget).kind];
          c.fillText(isTarget ? label : '', scr.x, scr.y + size + 13);
          c.fillText(d >= 1000 ? `${(d / 1000).toFixed(1)}` : `${Math.round(d)}`, scr.x, scr.y + size + (isTarget ? 26 : 13));
        }
        c.globalAlpha = 1;

        // Lock diamond.
        if (!friendly && pc.multiLocks.includes(t)) this.diamond(c, scr.x, scr.y, size + 6, RED, true);
        if (isTarget && !friendly) {
          if (pc.locked && pc.multiLocks.length === 0) {
            this.diamond(c, scr.x, scr.y, size + 6, RED, true);
          } else if (pc.lockProgress > 0 && pc.multiLocks.length === 0) {
            const k = 1 - pc.lockProgress;
            this.diamond(c, scr.x, scr.y, size + 6 + k * 60, GREEN, false);
          }
        }
      }
    }

    // Off-screen arrow for the selected target.
    const t = pc.target;
    if (t) {
      this.project(t.position, cam, scr);
      const off = scr.behind || scr.x < 0 || scr.x > this.w || scr.y < 0 || scr.y > this.h;
      if (off) {
        _q.copy(t.position).sub(ac.position).applyMatrix4(_mInv.copy(cam.matrixWorld).invert().setPosition(0, 0, 0));
        const ang = Math.atan2(_q.x, _q.y);
        const r = Math.min(this.w, this.h) * 0.32;
        const x = this.w / 2 + Math.sin(ang) * r, y = this.h / 2 - Math.cos(ang) * r;
        c.save();
        c.translate(x, y);
        c.rotate(ang);
        c.fillStyle = t.isAir ? RED : ORANGE;
        c.beginPath(); c.moveTo(0, -16); c.lineTo(10, 6); c.lineTo(-10, 6); c.closePath(); c.fill();
        c.restore();
        c.fillStyle = WHITE;
        c.textAlign = 'center';
        const d = t.position.distanceTo(ac.position);
        c.fillText(`${(d / 1000).toFixed(1)}`, x, y + 22);
      }
    }
  }

  private bracket(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const k = s * 0.45;
    c.beginPath();
    c.moveTo(x - s, y - s + k); c.lineTo(x - s, y - s); c.lineTo(x - s + k, y - s);
    c.moveTo(x + s - k, y - s); c.lineTo(x + s, y - s); c.lineTo(x + s, y - s + k);
    c.moveTo(x + s, y + s - k); c.lineTo(x + s, y + s); c.lineTo(x + s - k, y + s);
    c.moveTo(x - s + k, y + s); c.lineTo(x - s, y + s); c.lineTo(x - s, y + s - k);
    c.stroke();
  }

  private diamond(c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string, solid: boolean) {
    c.strokeStyle = col;
    c.lineWidth = solid ? 2.4 : 1.6;
    c.beginPath();
    c.moveTo(x, y - s); c.lineTo(x + s, y); c.lineTo(x, y + s); c.lineTo(x - s, y); c.closePath();
    c.stroke();
  }

  private drawTapes(c: CanvasRenderingContext2D, ac: PlayerController['ac'], cx: number, cy: number) {
    const left = cx - Math.min(this.w * 0.26, 330);
    const right = cx + Math.min(this.w * 0.26, 330);
    c.font = '700 18px "Rajdhani", system-ui, sans-serif';
    c.lineWidth = 1.5;
    c.strokeStyle = GREEN;
    c.fillStyle = GREEN;
    // Speed (km/h) box.
    const kmh = Math.round(ac.speed * 3.6);
    c.textAlign = 'right';
    c.strokeRect(left - 78, cy - 16, 78, 30);
    c.fillText(`${kmh}`, left - 8, cy + 6);
    c.font = '600 11px "Rajdhani", system-ui, sans-serif';
    c.fillText('SPEED', left - 8, cy - 22);
    // Throttle bar.
    const thH = 90;
    c.strokeRect(left - 92, cy - thH / 2, 6, thH);
    c.fillStyle = ac.throttle > 0.85 ? ORANGE : GREEN;
    c.fillRect(left - 92, cy + thH / 2 - thH * ac.throttle, 6, thH * ac.throttle);
    c.fillStyle = GREEN;
    c.fillText(ac.throttle > 0.85 ? (ac.isHeli ? 'COLL MAX' : 'A/B') : ac.isHeli ? 'COLL' : 'THR', left - 8, cy + 40);
    c.fillText(`G ${ac.gForce.toFixed(1)}`, left - 8, cy + 56);
    if (ac.psm > 0.3) { c.fillStyle = ORANGE; c.fillText('HIGH-G', left - 8, cy + 72); c.fillStyle = GREEN; }

    // Altitude (m) box.
    c.font = '700 18px "Rajdhani", system-ui, sans-serif';
    c.textAlign = 'left';
    c.strokeRect(right, cy - 16, 84, 30);
    c.fillText(`${Math.round(ac.position.y)}`, right + 8, cy + 6);
    c.font = '600 11px "Rajdhani", system-ui, sans-serif';
    c.fillText('ALT', right + 8, cy - 22);
    c.fillStyle = ac.altitude < 150 ? ORANGE : GREEN;
    c.fillText(`R ${Math.round(ac.altitude)}`, right + 8, cy + 30);
    c.fillStyle = GREEN;
    const vs = ac.velocity.y;
    c.fillText(`VS ${vs >= 0 ? '+' : ''}${Math.round(vs)}`, right + 8, cy + 45);
  }

  private drawHeading(c: CanvasRenderingContext2D, ac: PlayerController['ac'], cx: number) {
    const hdg = headingOf(ac.forward(_fwd));
    const y = 34, width = 300;
    c.save();
    c.beginPath(); c.rect(cx - width / 2, y - 22, width, 40); c.clip();
    c.strokeStyle = GREEN_DIM;
    c.fillStyle = GREEN;
    c.font = '600 12px "Rajdhani", system-ui, sans-serif';
    c.textAlign = 'center';
    const pxPerDeg = 3.2;
    for (let d = Math.floor((hdg - 50) / 5) * 5; d <= hdg + 50; d += 5) {
      const x = cx + (d - hdg) * pxPerDeg;
      const dd = ((d % 360) + 360) % 360;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + (dd % 10 === 0 ? 8 : 4)); c.stroke();
      if (dd % 30 === 0) {
        const label = dd === 0 ? 'N' : dd === 90 ? 'E' : dd === 180 ? 'S' : dd === 270 ? 'W' : `${dd / 10}`;
        c.fillText(label, x, y - 4);
      }
    }
    c.restore();
    c.strokeStyle = GREEN;
    c.beginPath(); c.moveTo(cx, y + 10); c.lineTo(cx - 5, y + 17); c.lineTo(cx + 5, y + 17); c.closePath(); c.stroke();
    c.font = '700 13px "Rajdhani", system-ui, sans-serif';
    c.fillStyle = GREEN;
    c.textAlign = 'center';
    c.fillText(`${Math.round(hdg).toString().padStart(3, '0')}`, cx, y + 32);
  }

  private drawRadar(c: CanvasRenderingContext2D, game: GameContext, pc: PlayerController) {
    const ac = pc.ac;
    const R = Math.min(105, this.h * 0.14);
    const x0 = this.w - R - 24, y0 = this.h - R - 24;
    const range = 8000;
    const hdg = Math.atan2(ac.forward(_fwd).x, -_fwd.z);
    const cos = Math.cos(hdg), sin = Math.sin(hdg);
    c.save();
    c.fillStyle = 'rgba(5,20,12,0.55)';
    c.strokeStyle = GREEN_DIM;
    c.lineWidth = 1;
    c.beginPath(); c.arc(x0, y0, R, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(x0, y0, R / 2, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(x0 - R, y0); c.lineTo(x0 + R, y0); c.moveTo(x0, y0 - R); c.lineTo(x0, y0 + R); c.stroke();
    c.clip();
    const toScreen = (p: THREE.Vector3) => {
      const dx = p.x - ac.position.x, dz = p.z - ac.position.z;
      const rx = dx * cos + dz * sin;
      const rz = -dx * sin + dz * cos;
      return [x0 + (rx / range) * R, y0 + (rz / range) * R];
    };
    // Combat area boundary.
    c.strokeStyle = 'rgba(255,180,80,0.5)';
    c.beginPath();
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => toScreen(_v.set(sx * MAP.combatHalf, 0, sz * MAP.combatHalf)));
    corners.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath(); c.stroke();
    for (const g of game.ground) {
      if (!g.alive) continue;
      const [x, y] = toScreen(g.position);
      c.fillStyle = g.team === ac.team ? BLUE : ORANGE;
      const s = g.isMissionTarget ? 4 : 2.5;
      c.fillRect(x - s / 2, y - s / 2, s, s);
    }
    for (const a of game.aircraft) {
      if (!a.alive || a === ac) continue;
      const [x, y] = toScreen(a.position);
      a.forward(_q);
      const ah = Math.atan2(_q.x, -_q.z) - hdg;
      c.save();
      c.translate(x, y);
      c.rotate(ah);
      c.fillStyle = a.team === ac.team ? BLUE : RED;
      const s = a === pc.target ? 6 : 4;
      c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, s); c.lineTo(-s * 0.7, s); c.closePath(); c.fill();
      c.restore();
    }
    for (const m of game.missiles.list) {
      if (m.team === ac.team) continue;
      const [x, y] = toScreen(m.pos);
      c.fillStyle = WHITE;
      c.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    c.restore();
    c.fillStyle = GREEN;
    c.beginPath(); c.moveTo(x0, y0 - 6); c.lineTo(x0 + 4, y0 + 4); c.lineTo(x0 - 4, y0 + 4); c.closePath(); c.fill();
    c.font = '600 11px "Rajdhani", system-ui, sans-serif';
    c.textAlign = 'right';
    c.fillText(`${range / 1000}km`, x0 + R, y0 - R - 4);
  }

  private drawWeapons(c: CanvasRenderingContext2D, pc: PlayerController, time: number) {
    const ac = pc.ac;
    const x = this.w - 210, y = this.h - 2 * Math.min(105, this.h * 0.14) - 150;
    c.textAlign = 'left';
    c.font = '700 15px "Rajdhani", system-ui, sans-serif';
    const row = (label: string, value: string, active: boolean, yy: number, ready = true) => {
      c.fillStyle = active ? (ready ? GREEN : ORANGE) : GREEN_DIM;
      c.fillText(label, x, yy);
      c.textAlign = 'right';
      c.fillText(value, x + 180, yy);
      c.textAlign = 'left';
      if (active) { c.strokeStyle = GREEN; c.strokeRect(x - 6, yy - 15, 192, 20); }
    };
    const msl = WEAPONS[ac.spec.missile];
    const sp = WEAPONS[ac.spec.special];
    const mslReady = ac.weaponReadyIn(msl.id, time) <= 0;
    const spReady = ac.weaponReadyIn(sp.id, time) <= 0;
    row('GUN', `${ac.gunAmmo}`, false, y);
    row(msl.short, `${ac.missiles}`, pc.weaponSlot === 'MSL', y + 24, mslReady);
    row(sp.short, `${ac.specialAmmo}`, pc.weaponSlot === 'SP', y + 48, spReady);
    row('FLR', `${ac.flares}`, false, y + 72);
    const dmg = Math.round((1 - ac.hp / ac.maxHp) * 100);
    c.fillStyle = dmg > 60 ? RED : dmg > 30 ? ORANGE : GREEN;
    c.font = '700 18px "Rajdhani", system-ui, sans-serif';
    c.fillText(`DMG ${dmg}%`, x, y + 102);
    c.font = '600 12px "Rajdhani", system-ui, sans-serif';
    c.fillStyle = GREEN_DIM;
    c.fillText(ac.spec.short, x + 110, y + 102);
  }

  private drawStats(c: CanvasRenderingContext2D, stats: HudStat[], score: number) {
    c.textAlign = 'right';
    let y = 28;
    const x = this.w - 24;
    c.font = '600 12px "Rajdhani", system-ui, sans-serif';
    c.fillStyle = GREEN_DIM;
    c.fillText('SCORE', x - 80, y);
    c.font = '700 18px "Rajdhani", system-ui, sans-serif';
    c.fillStyle = GREEN;
    c.fillText(`${score}`, x, y + 2);
    y += 24;
    for (const s of stats) {
      c.font = '600 12px "Rajdhani", system-ui, sans-serif';
      c.fillStyle = GREEN_DIM;
      c.fillText(s.label, x - 80, y);
      c.font = '700 16px "Rajdhani", system-ui, sans-serif';
      c.fillStyle = s.warn ? RED : GREEN;
      c.fillText(s.value, x, y + 1);
      y += 22;
    }
  }

  private drawMap(c: CanvasRenderingContext2D, game: GameContext, pc: PlayerController) {
    const size = Math.min(this.w, this.h) * 0.8;
    const x0 = (this.w - size) / 2, y0 = (this.h - size) / 2;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(0, 0, this.w, this.h);
    if (this.mapImage) {
      c.globalAlpha = 0.9;
      c.drawImage(this.mapImage, x0, y0, size, size);
      c.globalAlpha = 1;
    }
    c.strokeStyle = GREEN;
    c.strokeRect(x0, y0, size, size);
    const toMap = (p: THREE.Vector3) => [x0 + ((p.x + MAP.half) / (MAP.half * 2)) * size, y0 + ((p.z + MAP.half) / (MAP.half * 2)) * size];
    c.strokeStyle = 'rgba(255,180,80,0.7)';
    c.setLineDash([6, 6]);
    const [bx0, by0] = toMap(_v.set(-MAP.combatHalf, 0, -MAP.combatHalf));
    const [bx1, by1] = toMap(_v.set(MAP.combatHalf, 0, MAP.combatHalf));
    c.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    c.setLineDash([]);
    for (const g of game.ground) {
      if (!g.alive) continue;
      const [x, y] = toMap(g.position);
      c.fillStyle = g.team === pc.ac.team ? BLUE : ORANGE;
      const s = g.isMissionTarget ? 6 : 3;
      c.fillRect(x - s / 2, y - s / 2, s, s);
      if (g.isMissionTarget) { c.strokeStyle = WHITE; c.strokeRect(x - 5, y - 5, 10, 10); }
    }
    for (const a of game.aircraft) {
      if (!a.alive) continue;
      const [x, y] = toMap(a.position);
      c.fillStyle = a === pc.ac ? WHITE : a.team === pc.ac.team ? BLUE : RED;
      c.beginPath(); c.arc(x, y, a === pc.ac ? 5 : 3, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = WHITE;
    c.textAlign = 'center';
    c.font = '700 14px "Rajdhani", system-ui, sans-serif';
    c.fillText('TACTICAL MAP — VARGA ISLAND   [M] close', this.w / 2, y0 - 10);
    c.font = '600 11px "Rajdhani", system-ui, sans-serif';
    c.fillText(`Mission time ${formatTime(game.time)}`, this.w / 2, y0 + size + 18);
  }
}

const _mInv = new THREE.Matrix4();
