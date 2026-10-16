import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { Atmosphere, TIMES } from './world/Atmosphere';
import { World } from './world/World';
import { Effects } from './systems/Effects';
import { Bullets } from './systems/Bullets';
import { Missiles } from './systems/Missiles';
import { Flares } from './systems/Flares';
import { AudioSystem } from './Audio';
import { Input } from './Input';
import { HUD } from './HUD';
import { CameraRig } from './CameraRig';
import { PlayerController } from './PlayerController';
import { Aircraft } from './entities/Aircraft';
import { GroundTarget } from './entities/GroundTarget';
import { PilotAI, type AIRole } from './ai/PilotAI';
import { Mission, type MissionHost } from './missions/Mission';
import { AttackMission } from './missions/AttackMission';
import { DefenseMission } from './missions/DefenseMission';
import type { Combatant, GameContext, GameEvents } from './core/context';
import type { AircraftId } from './data/aircraft';
import { DIFFICULTY_TUNING, type MissionConfig, type Settings, type Team, type Quality } from './data/types';
import { FRIENDLY_BASE } from './world/layout';
import { clamp, rand } from './core/utils';
import { useGameStore } from '../store';

type Phase = 'MENU' | 'PLAYING' | 'PAUSED' | 'ENDING';

/**
 * Owns the renderer, the world and the simulation loop. React only renders
 * menus/overlays and talks to the engine through this class.
 */
export class Engine implements MissionHost {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 1, 60000);
  readonly atmosphere: Atmosphere;
  readonly world: World;
  readonly input = new Input();
  readonly audio = new AudioSystem();
  readonly hud: HUD;
  readonly rig: CameraRig;
  readonly ctx: GameContext;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private mirrorCam = new THREE.PerspectiveCamera(70, 3, 1, 20000);
  private settings: Settings;
  private quality: Quality;
  private phase: Phase = 'MENU';
  private mission: Mission | null = null;
  private pc: PlayerController | null = null;
  private config: MissionConfig | null = null;
  private score = 0;
  private kills = { air: 0, ground: 0 };
  private endTimer = 0;
  private raf = 0;
  private last = performance.now();
  private publishTimer = 0;
  private menuTraffic: Aircraft[] = [];
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement, settings: Settings) {
    this.settings = { ...settings };
    this.quality = settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.atmosphere = new Atmosphere(this.scene, this.renderer);
    this.world = new World(this.scene, this.quality);
    this.hud = new HUD(hudCanvas);
    this.hud.setMapImage(this.world.mapImage);
    this.rig = new CameraRig(this.camera);
    this.scene.add(this.camera);

    const events: GameEvents = {
      destroyed: (v, k) => this.onDestroyed(v, k),
      hit: (v, a, m) => this.onHit(v, a, m),
      missileMissed: (o) => { if (o?.isPlayer) this.hud.notify('MISSED', '#b8c4bd'); },
      radio: (from, text, tone) => this.radio(from, text, tone),
    };
    const effects = new Effects(this.scene, this.quality === 'LOW' ? 2500 : 5000);
    this.ctx = {
      scene: this.scene,
      camera: this.camera,
      terrain: this.world.terrain,
      effects,
      bullets: new Bullets(this.scene),
      missiles: new Missiles(this.scene),
      flares: new Flares(),
      audio: this.audio,
      aircraft: [],
      ground: this.world.ground,
      player: null,
      time: 0,
      difficulty: 'NORMAL',
      tuning: DIFFICULTY_TUNING.NORMAL,
      events,
    };

    this.applyTime(TIMES.DAWN);
    this.applySettings(settings, true);
    this.input.attach(canvas.parentElement ?? canvas);
    this.input.onUnlock = () => { if (this.phase === 'PLAYING') this.pause(); };
    this.resize();
    window.addEventListener('resize', this.resize);
    this.spawnMenuTraffic();
    this.loop();
  }

  get ground() { return this.world.ground; }

  // ================================================================ settings

  private applyTime(t: typeof TIMES.MIDDAY) {
    this.atmosphere.apply(t);
    this.world.water.sync(this.atmosphere.fog, this.atmosphere.sunDir, this.atmosphere.sun.color);
    this.world.clouds?.sync(this.atmosphere.fog, this.atmosphere.sun.color);
    this.ctx?.effects.syncFog(this.atmosphere.fog);
  }

  applySettings(s: Settings, initial = false) {
    const qualityChanged = s.quality !== this.quality;
    const cloudsChanged = initial || s.clouds !== this.settings.clouds || qualityChanged;
    this.settings = { ...s };
    this.quality = s.quality;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(s.quality === 'LOW' ? Math.min(dpr, 1) : s.quality === 'MEDIUM' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
    this.renderer.shadowMap.enabled = s.quality === 'HIGH';
    this.atmosphere.setShadows(s.quality === 'HIGH');
    if (qualityChanged && !initial) this.world.buildTerrain(s.quality);
    if (cloudsChanged) {
      this.world.setClouds(s.clouds, s.quality);
      this.world.clouds?.sync(this.atmosphere.fog, this.atmosphere.sun.color);
    }
    this.rig.baseFov = s.fov;
    this.audio.setVolume(s.masterVolume / 100);
    this.setupComposer(s.bloom && s.quality !== 'LOW');
    this.resize();
  }

  private setupComposer(enabled: boolean) {
    if (!enabled) {
      this.composer?.dispose();
      this.composer = null;
      this.bloom = null;
      return;
    }
    if (this.composer) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Tone map first, then bloom in display space: only afterburners, tracers,
    // explosions and sun glints cross the threshold (the HDR sky would not).
    this.composer.addPass(new OutputPass());
    this.bloom = new UnrealBloomPass(size, 0.3, 0.25, 0.9);
    this.composer.addPass(this.bloom);
    // Plain copy to the canvas so nothing gets tone mapped twice.
    this.composer.addPass(new ShaderPass(CopyShader));
  }

  private resize = () => {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.hud.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
  };

  // ================================================================ spawning

  spawnAircraft(id: AircraftId, team: Team, name: string, pos: THREE.Vector3, heading: number, speed: number, role: AIRole = 'FIGHTER', skill = 0.6): Aircraft {
    const a = new Aircraft(id, team, name);
    a.spawn(pos, heading, speed);
    const t = this.ctx.tuning;
    const s = team === 'RED' ? clamp(skill * (0.55 + t.aiAccuracy * 0.6), 0.2, 1) : skill;
    a.ai = new PilotAI(role, s);
    a.ai.cruiseAlt = pos.y;
    a.ai.waypoint.copy(pos).addScaledVector(a.forward(new THREE.Vector3()), 5000);
    this.scene.add(a.model.root);
    this.ctx.aircraft.push(a);
    return a;
  }

  spawnPlayer(pos: THREE.Vector3, heading: number, speed: number): Aircraft {
    const a = new Aircraft(this.config!.aircraft, 'BLUE', 'Apex 1');
    a.isPlayer = true;
    a.spawn(pos, heading, speed);
    if (a.isHeli) a.throttle = 0.5;
    this.scene.add(a.model.root);
    this.ctx.aircraft.push(a);
    this.ctx.player = a;
    this.pc = new PlayerController(a);
    this.rig.reset(a);
    return a;
  }

  private spawnMenuTraffic() {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Vector3(FRIENDLY_BASE.x + rand(-2000, 2000), 900 + i * 150, FRIENDLY_BASE.z + rand(-2000, 2000));
      const a = this.spawnAircraft(i === 2 ? 'F22' : 'F14', 'BLUE', `Patrol ${i + 1}`, p, rand(0, Math.PI * 2), 200, 'FIGHTER', 0.7);
      a.ai!.cruiseAlt = 900 + i * 150;
      this.menuTraffic.push(a);
    }
  }

  private clearEntities() {
    for (const a of this.ctx.aircraft) a.dispose(this.scene);
    this.ctx.aircraft.length = 0;
    this.menuTraffic = [];
    this.ctx.bullets.clear();
    this.ctx.missiles.clear();
    this.ctx.flares.clear();
    this.ctx.effects.clear();
    this.ctx.player = null;
    this.pc = null;
  }

  // ================================================================ mission flow

  startMission(config: MissionConfig) {
    this.audio.init();
    this.clearEntities();
    this.world.resetTargets();
    this.config = config;
    this.ctx.difficulty = config.difficulty;
    this.ctx.tuning = DIFFICULTY_TUNING[config.difficulty];
    this.ctx.time = 0;
    this.score = 0;
    this.kills = { air: 0, ground: 0 };
    this.endTimer = 0;
    const store = useGameStore.getState();
    store.resetMissionUi();
    this.mission = config.mode === 'ATTACK' ? new AttackMission(this, config) : new DefenseMission(this, config);
    this.applyTime(this.mission.time);
    store.setMissionTitle(this.mission.title);
    this.mission.setup();
    this.rig.mode = config.aircraft === 'AH64' ? 'CHASE' : this.rig.mode === 'CHASE_FAR' ? 'CHASE_FAR' : this.rig.mode;
    this.phase = 'PLAYING';
    this.input.enabled = true;
    this.input.requestLock();
    this.publish(true);
    store.setScreen('PLAYING');
  }

  pause() {
    if (this.phase !== 'PLAYING') return;
    this.phase = 'PAUSED';
    this.input.enabled = false;
    this.input.releaseLock();
    this.audio.silence();
    useGameStore.getState().setScreen('PAUSED');
  }

  resume() {
    if (this.phase !== 'PAUSED') return;
    this.phase = 'PLAYING';
    this.input.enabled = true;
    this.input.requestLock();
    this.last = performance.now();
    useGameStore.getState().setScreen('PLAYING');
  }

  quitToMenu() {
    this.phase = 'MENU';
    this.input.enabled = false;
    this.input.releaseLock();
    this.audio.silence();
    this.clearEntities();
    this.world.resetTargets();
    this.hud.clear();
    this.mission = null;
    this.applyTime(TIMES.DAWN);
    this.spawnMenuTraffic();
    useGameStore.getState().resetMissionUi();
  }

  private finish() {
    const m = this.mission!;
    const p = this.ctx.player!;
    const total = this.score + (m.status === 'SUCCESS' ? m.bonus : 0);
    useGameStore.getState().setResult({
      success: m.status === 'SUCCESS',
      reason: m.status === 'SUCCESS' ? 'Mission accomplished.' : m.failReason,
      score: total,
      time: m.elapsed,
      airKills: this.kills.air,
      groundKills: this.kills.ground,
      shotsFired: p.stats.shots,
      hits: p.stats.hits,
      rank: m.status === 'SUCCESS' ? m.rank(total) : 'D',
      mode: m.mode,
      aircraft: this.config!.aircraft,
    });
    this.phase = 'MENU';
    this.input.enabled = false;
    this.input.releaseLock();
    this.audio.silence();
    this.hud.clear();
    useGameStore.getState().setScreen('RESULTS');
  }

  // ================================================================ host API

  radio(from: string, text: string, tone: 'ally' | 'enemy' | 'command' | 'system') {
    if (this.phase === 'MENU') return;
    useGameStore.getState().pushRadio({ from, text, tone });
  }

  banner(title: string, subtitle: string | undefined, tone: 'info' | 'success' | 'danger') {
    useGameStore.getState().setBanner({ title, subtitle, tone });
  }

  addScore(n: number) { this.score += n; }

  private onDestroyed(victim: Combatant, killer: Aircraft | null) {
    if (this.phase === 'MENU') return;
    if (killer?.isPlayer && victim.team !== 'BLUE') {
      this.score += victim.score;
      if (victim.isAir) this.kills.air++; else this.kills.ground++;
      this.hud.notify('DESTROYED', '#ff5a4a');
      this.audio.hitConfirm();
      if (Math.random() < 0.35) {
        const lines = ['Good kill, Apex 1!', 'Target destroyed.', 'Splash one!', 'Nice shooting, Apex 1.'];
        this.radio('Overwatch', lines[Math.floor(Math.random() * lines.length)], 'command');
      }
    } else if (victim.team === 'RED' && killer && !killer.isPlayer) {
      this.score += Math.round(victim.score * 0.1);
    }
    if (victim instanceof Aircraft && victim.team === 'BLUE' && !victim.isPlayer) {
      this.radio(victim.name, 'I\'m hit! Ejecting!', 'ally');
    }
    if (victim === this.ctx.player) this.rig.addShake(1.5);
    this.mission?.onDestroyed(victim, killer);
  }

  private onHit(victim: Combatant, attacker: Aircraft | null, missile: boolean) {
    if (this.phase === 'MENU') return;
    if (attacker?.isPlayer && victim.team !== 'BLUE') {
      this.hud.hitMarker = 0.18;
      if (missile && victim.alive) this.hud.notify('HIT', '#ffb347');
    }
    if (victim === this.ctx.player) {
      this.hud.damageFlash = missile ? 1 : 0.5;
      this.rig.addShake(missile ? 1 : 0.25);
      this.audio.playerHit();
    }
    if (victim instanceof GroundTarget && victim.team === 'BLUE' && missile) this.rig.addShake(0.05);
  }

  // ================================================================ loop

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.input.poll();
    try {
      this.frame(dt);
    } catch (err) {
      console.error(err);
    }
    this.input.endFrame();
  };

  private frame(dt: number) {
    const ctx = this.ctx;
    const playing = this.phase === 'PLAYING' || this.phase === 'ENDING';

    if (this.phase !== 'PAUSED') {
      const steps = dt > 1 / 45 ? 2 : 1;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) this.simulate(h, i === 0);
    }

    // Camera.
    if (playing && ctx.player && this.pc) {
      if (this.pc.actions.camera) this.rig.cycle();
      this.rig.update(dt, ctx.player, this.pc, ctx.terrain, this.settings.controlMode === 'MOUSE_AIM');
      const near = this.rig.mode === 'COCKPIT' || this.rig.mode === 'HUD' ? 0.15 : 1;
      if (this.camera.near !== near) { this.camera.near = near; this.camera.updateProjectionMatrix(); }
    } else if (this.phase === 'MENU') {
      this.rig.updateCinematic(dt, ctx.terrain);
    }
    this.camera.updateMatrixWorld();
    this.atmosphere.update(this.camera.position);
    this.world.update(this.phase === 'PAUSED' ? 0 : dt, this.camera);
    this.audio.setListener(this.camera.position);

    this.render();

    // HUD.
    if (playing && ctx.player && this.pc && this.mission) {
      if (this.pc.actions.map) this.hud.showMap = !this.hud.showMap;
      this.hud.cloud = this.world.clouds && this.rig.mode !== 'CHASE_FAR' ? this.world.clouds.densityAt(this.camera.position) : 0;
      const incoming = ctx.missiles.incoming(ctx.player);
      this.hud.missileWarn = incoming.length > 0;
      if (this.hud.missileWarn) this.audio.missileAlert();
      this.hud.lockWarn = ctx.aircraft.some((a) => a.alive && a.ai && a.ai.target === ctx.player && a.ai.lockTime > 0.4)
        || ctx.ground.some((g) => g.isLocking(ctx.player!));
      this.hud.draw(dt, ctx, this.pc, this.rig.mode, this.mission.stats(), this.score, this.settings.controlMode === 'MOUSE_AIM');
      if (this.settings.rearMirror && ctx.player.alive) this.drawMirrorFrame();
      this.audio.updateEngine(dt, ctx.player.throttle, ctx.player.speed, ctx.player.spec.kind, ctx.player.alive && this.phase === 'PLAYING');
    }
  }

  private simulate(dt: number, firstStep = true) {
    const ctx = this.ctx;
    const playing = this.phase === 'PLAYING' || this.phase === 'ENDING';
    ctx.time += dt;

    if (playing && this.pc && ctx.player) {
      this.pc.update(dt, ctx, this.input, this.settings, firstStep);
      if (this.pc.actions.pause && this.phase === 'PLAYING') { this.pause(); return; }
    }
    for (const a of ctx.aircraft) {
      if (a.ai && a.alive) a.ai.update(dt, ctx, a);
      a.update(dt, ctx);
    }
    for (let i = ctx.aircraft.length - 1; i >= 0; i--) {
      const a = ctx.aircraft[i];
      if (a.removed && a !== ctx.player) {
        a.dispose(this.scene);
        ctx.aircraft.splice(i, 1);
      }
    }
    for (const g of ctx.ground) {
      const radarAlive = g.kind === 'SAM' && ctx.ground.some((r) => r.alive && r.team === g.team && (r.kind === 'RADAR' || r.kind === 'RADOME') && r.position.distanceTo(g.position) < 9000);
      g.update(dt, ctx, radarAlive);
    }
    ctx.bullets.update(dt, ctx);
    ctx.missiles.update(dt, ctx);
    ctx.flares.update(dt, ctx.effects);
    ctx.effects.update(dt);

    if (this.phase === 'MENU') {
      // Keep the attract-mode patrol alive.
      for (const a of this.menuTraffic) if (!a.alive) a.removed = true;
      return;
    }

    if (this.mission && this.phase === 'PLAYING') {
      this.mission.update(dt);
      if (this.mission.status !== 'RUNNING') {
        this.phase = 'ENDING';
        this.endTimer = this.mission.status === 'SUCCESS' ? 4 : 4.5;
        if (this.mission.status === 'SUCCESS') {
          this.banner('MISSION ACCOMPLISHED', this.mission.title, 'success');
          this.radio('Overwatch', 'All targets neutralised. Outstanding work, Apex squadron. RTB.', 'command');
        } else {
          this.banner('MISSION FAILED', this.mission.failReason, 'danger');
        }
        this.publish(true);
      }
    }
    if (this.phase === 'ENDING') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) { this.finish(); return; }
    }

    this.publishTimer -= dt;
    if (this.publishTimer <= 0) { this.publishTimer = 0.25; this.publish(false); }
  }

  private publish(force: boolean) {
    const m = this.mission;
    if (!m) return;
    if (m.dirty || force) {
      m.dirty = false;
      useGameStore.getState().setObjectives(m.objectives);
    }
  }

  private render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    const p = this.ctx.player;
    if (this.settings.rearMirror && p?.alive && this.phase === 'PLAYING') {
      const size = this.renderer.getSize(new THREE.Vector2());
      const mw = Math.min(360, size.x * 0.3), mh = mw / 3.2;
      const x = (size.x - mw) / 2, y = size.y - mh - 58;
      this.mirrorCam.aspect = mw / mh;
      this.mirrorCam.updateProjectionMatrix();
      const back = new THREE.Vector3(0, 0, 1).applyQuaternion(p.quaternion);
      this.mirrorCam.position.copy(p.position).add(new THREE.Vector3(0, 3, 0).applyQuaternion(p.quaternion)).addScaledVector(back, p.model.length * 0.55);
      this.mirrorCam.up.set(0, 1, 0).applyQuaternion(p.quaternion);
      this.mirrorCam.lookAt(this.mirrorCam.position.clone().add(back));
      this.mirrorCam.updateMatrixWorld();
      const r = this.renderer;
      r.setScissorTest(true);
      r.setScissor(x, y, mw, mh);
      r.setViewport(x, y, mw, mh);
      r.render(this.scene, this.mirrorCam);
      r.setScissorTest(false);
      r.setViewport(0, 0, size.x, size.y);
    }
  }

  private drawMirrorFrame() {
    const c = (this.hud as any).ctx2d as CanvasRenderingContext2D;
    const size = this.renderer.getSize(new THREE.Vector2());
    const mw = Math.min(360, size.x * 0.3), mh = mw / 3.2;
    const x = (size.x - mw) / 2, y = 58;
    c.strokeStyle = 'rgba(141,255,182,0.7)';
    c.lineWidth = 2;
    c.strokeRect(x, y, mw, mh);
    c.fillStyle = 'rgba(141,255,182,0.8)';
    c.font = '600 10px "Rajdhani", system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('REAR VIEW', size.x / 2, y + mh + 12);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.input.detach();
    this.input.releaseLock();
    this.audio.silence();
    this.renderer.dispose();
  }
}
