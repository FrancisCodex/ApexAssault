import React, { useMemo, useState } from 'react';
import { ChevronLeft, Crosshair, Shield, Github, Trophy } from 'lucide-react';
import { useGameStore } from '../store';
import { getEngine } from '../game/engineRef';
import { AIRCRAFT, PLAYABLE } from '../game/data/aircraft';
import { WEAPONS } from '../game/data/weapons';
import type { Difficulty, MissionMode } from '../game/data/types';
import { MAP, FRIENDLY_BASE, ENEMY_BASE, PASS } from '../game/world/layout';
import { formatTime } from '../game/core/utils';
import { Panel, Heading, MenuButton, StatBar, Segmented } from './ui';
import { AircraftPreview } from './AircraftPreview';
import { SettingsPanel } from './SettingsPanel';
import { ControlsHelp } from './ControlsHelp';
import logo from '../assets/Apex_Logo.png';

const MISSIONS: Record<MissionMode, { title: string; tag: string; time: string; brief: string; objectives: string[] }> = {
  ATTACK: {
    title: 'Operation Hammerfall',
    tag: 'Offensive strike',
    time: 'Midday · clear skies, scattered cumulus',
    brief: 'Kessel Federation forces hold the eastern plateau of Varga Island. Break through the SAM belt guarding Greyspine Pass, dismantle the air defenses of Kessel Ridge Air Base and destroy their command bunker to end enemy operations on the island.',
    objectives: ['Destroy Greyspine Pass SAMs, AA and ridge radar', 'Neutralise Kessel Ridge AB defenses & hangars', 'Destroy the Kessel Command HQ bunker', 'Beware: enemy ace squadron'],
  },
  DEFENSE: {
    title: 'Operation Iron Bastion',
    tag: 'Air defense',
    time: 'Dawn · enemy attacks out of the sunrise',
    brief: 'Intelligence reports the Kessel Federation is massing bombers to wipe out Port Ardent Air Base. Hold the skies over the base through five escalating raids. Bombers are the priority — if the base falls, the island falls.',
    objectives: ['Repel 5 raids of fighters, bombers and attackers', 'Keep base integrity above 35%', 'Protect Base Command', 'Friendly AA and Patriot batteries support you'],
  },
};

export const LoadingScreen = () => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#05080a] text-white">
    <img src={logo} alt="" className="w-24 h-24 mb-6 opacity-90" />
    <div className="font-display text-3xl tracking-[0.4em] uppercase">Apex Assault</div>
    <div className="mt-6 w-64 h-0.5 bg-white/10 overflow-hidden">
      <div className="h-full w-1/3 bg-amber-400 animate-[loading_1.2s_ease-in-out_infinite]" />
    </div>
    <div className="mt-3 text-xs tracking-[0.3em] text-white/50 uppercase">Generating Varga Island…</div>
  </div>
);

export const MainMenu = () => {
  const { setScreen, records, setShowSettings } = useGameStore();
  const [showControls, setShowControls] = useState(false);
  return (
    <div className="absolute inset-0 z-40 flex items-stretch bg-gradient-to-r from-black/85 via-black/40 to-transparent">
      <div className="flex flex-col justify-center gap-8 px-6 sm:px-14 py-10 w-full max-w-xl">
        <div>
          <div className="flex items-center gap-3 text-amber-300/80 text-xs tracking-[0.4em] uppercase">
            <img src={logo} alt="" className="w-8 h-8" /> Varga Island Conflict
          </div>
          <h1 className="font-display text-6xl sm:text-7xl font-bold text-white tracking-tight leading-none mt-3">
            APEX<br /><span className="text-amber-400">ASSAULT</span>
          </h1>
          <p className="text-white/60 mt-4 max-w-sm text-sm leading-relaxed">
            Modern air combat over a contested island. Fly strike missions deep into enemy territory or hold the line over your home base.
          </p>
        </div>
        <div className="flex flex-col gap-2 max-w-xs">
          <MenuButton primary onClick={() => setScreen('MISSIONS')}>Sortie</MenuButton>
          <MenuButton onClick={() => setShowControls(true)}>Flight Manual</MenuButton>
          <MenuButton onClick={() => setShowSettings(true)}>Settings</MenuButton>
        </div>
        {(records.ATTACK || records.DEFENSE) && (
          <Panel className="p-4 max-w-sm">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 mb-2"><Trophy className="w-4 h-4 text-amber-300" /> Service record</div>
            {(['ATTACK', 'DEFENSE'] as MissionMode[]).map((m) => records[m] && (
              <div key={m} className="flex justify-between text-sm text-white/80 py-0.5">
                <span>{MISSIONS[m].title}</span>
                <span className="font-mono"><span className="text-amber-300">{records[m]!.rank}</span> · {records[m]!.score}</span>
              </div>
            ))}
          </Panel>
        )}
        <a href="https://github.com/FrancisCodex" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/40 hover:text-white text-xs">
          <Github className="w-4 h-4" /> Made by @FrancisCodex
        </a>
      </div>
      {showControls && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowControls(false)}>
          <Panel className="w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6">
            <div onClick={(e) => e.stopPropagation()}>
              <Heading sub="Pilot handbook">Flight Manual</Heading>
              <ControlsHelp />
              <div className="mt-5"><MenuButton small onClick={() => setShowControls(false)}>Close</MenuButton></div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};

const MapThumb = ({ mode }: { mode: MissionMode }) => {
  const src = useMemo(() => getEngine()?.world.mapImage.toDataURL() ?? '', []);
  const pct = (v: number) => `${((v + MAP.half) / (MAP.half * 2)) * 100}%`;
  const markers = [
    { x: FRIENDLY_BASE.x, z: FRIENDLY_BASE.z, label: 'Port Ardent AB', color: 'bg-sky-400' },
    { x: PASS.x, z: PASS.z, label: 'Greyspine Pass', color: 'bg-orange-400' },
    { x: ENEMY_BASE.x, z: ENEMY_BASE.z, label: 'Kessel Ridge AB', color: 'bg-red-500' },
  ];
  return (
    <div className="relative aspect-square w-full bg-black/50 border border-white/10 overflow-hidden">
      {src && <img src={src} alt="Map of Varga Island" className="absolute inset-0 w-full h-full object-cover opacity-90" />}
      {markers.map((m) => (
        <div key={m.label} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: pct(m.x), top: pct(m.z) }}>
          <span className={`w-2.5 h-2.5 ${m.color} ring-2 ring-black/60`} />
          <span className="mt-1 text-[10px] font-display tracking-widest uppercase text-white bg-black/60 px-1 whitespace-nowrap">{m.label}</span>
        </div>
      ))}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {mode === 'ATTACK' ? (
          <path d={`M ${pctN(FRIENDLY_BASE.x)} ${pctN(FRIENDLY_BASE.z)} L ${pctN(PASS.x)} ${pctN(PASS.z)} L ${pctN(ENEMY_BASE.x)} ${pctN(ENEMY_BASE.z)}`} stroke="#fbbf24" strokeWidth="0.6" strokeDasharray="2 1.5" fill="none" />
        ) : (
          <path d={`M 92 ${pctN(FRIENDLY_BASE.z) - 10} L ${pctN(FRIENDLY_BASE.x) + 4} ${pctN(FRIENDLY_BASE.z)} M 92 ${pctN(FRIENDLY_BASE.z) + 10} L ${pctN(FRIENDLY_BASE.x) + 4} ${pctN(FRIENDLY_BASE.z)}`} stroke="#ef4444" strokeWidth="0.6" strokeDasharray="2 1.5" fill="none" />
        )}
      </svg>
    </div>
  );
};
const pctN = (v: number) => ((v + MAP.half) / (MAP.half * 2)) * 100;

export const MissionSelect = () => {
  const { mode, setMode, difficulty, setDifficulty, setScreen } = useGameStore();
  const m = MISSIONS[mode];
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-black/55">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <button onClick={() => setScreen('MENU')} className="flex items-center gap-1 text-white/60 hover:text-white text-sm uppercase tracking-widest mb-4"><ChevronLeft className="w-4 h-4" /> Back</button>
        <Heading sub="Mission briefing">Select Operation</Heading>
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {(['ATTACK', 'DEFENSE'] as MissionMode[]).map((k) => {
            const sel = mode === k;
            const Icon = k === 'ATTACK' ? Crosshair : Shield;
            return (
              <button key={k} onClick={() => setMode(k)} className={`text-left p-5 border transition-all ${sel ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40 hover:border-white/30'}`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-6 h-6 ${sel ? 'text-amber-300' : 'text-white/50'}`} />
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">{k === 'ATTACK' ? 'Attack' : 'Defend'} · {MISSIONS[k].tag}</div>
                    <div className="font-display text-2xl text-white uppercase tracking-wide">{MISSIONS[k].title}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
          <MapThumb mode={mode} />
          <Panel className="p-6 flex flex-col gap-5">
            <div>
              <div className="text-xs uppercase tracking-widest text-amber-300/80">{m.time}</div>
              <p className="text-white/80 mt-2 leading-relaxed text-sm">{m.brief}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Objectives</div>
              <ul className="space-y-1.5">
                {m.objectives.map((o) => (
                  <li key={o} className="flex gap-2 text-sm text-white/85"><span className="text-amber-300">▸</span>{o}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Difficulty</div>
              <Segmented<Difficulty>
                value={difficulty}
                onChange={setDifficulty}
                options={[{ value: 'EASY', label: 'Easy' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HARD', label: 'Hard' }, { value: 'ACE', label: 'Ace' }]}
              />
            </div>
            <div className="mt-auto flex gap-3">
              <MenuButton primary onClick={() => setScreen('HANGAR')}>Select Aircraft ▸</MenuButton>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export const Hangar = () => {
  const { aircraft, setAircraft, setScreen, mode, difficulty } = useGameStore();
  const spec = AIRCRAFT[aircraft];
  const launch = () => getEngine()?.startMission({ mode, aircraft, difficulty });
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-black/55">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <button onClick={() => setScreen('MISSIONS')} className="flex items-center gap-1 text-white/60 hover:text-white text-sm uppercase tracking-widest mb-4"><ChevronLeft className="w-4 h-4" /> Briefing</button>
        <Heading sub={`${MISSIONS[mode].title} · ${difficulty}`}>Hangar</Heading>
        <div className="grid lg:grid-cols-[220px_1fr_300px] gap-4">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-1">
            {PLAYABLE.map((id) => (
              <button
                key={id}
                onClick={() => setAircraft(id)}
                className={`shrink-0 text-left px-4 py-3 border transition-all ${aircraft === id ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40 hover:border-white/30'}`}
              >
                <div className="font-display text-lg uppercase tracking-wider text-white">{AIRCRAFT[id].short}</div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">{AIRCRAFT[id].role}</div>
              </button>
            ))}
          </div>
          <Panel className="relative min-h-[260px] lg:min-h-[420px]">
            <AircraftPreview id={aircraft} />
            <div className="absolute left-4 bottom-4 right-4">
              <div className="font-display text-2xl sm:text-3xl text-white uppercase">{spec.name}</div>
              <p className="text-white/65 text-sm max-w-lg mt-1">{spec.description}</p>
            </div>
          </Panel>
          <Panel className="p-5 flex flex-col gap-4">
            <div className="space-y-2.5">
              <StatBar label="Speed" value={spec.ui.speed} />
              <StatBar label="Mobility" value={spec.ui.mobility} />
              <StatBar label="Armor" value={spec.ui.armor} />
              <StatBar label="Air-Air" value={spec.ui.air} color="bg-sky-300" />
              <StatBar label="Air-Gnd" value={spec.ui.ground} color="bg-orange-300" />
            </div>
            <div className="border-t border-white/10 pt-3 space-y-2 text-sm">
              <div className="text-xs uppercase tracking-widest text-white/50">Loadout</div>
              <div className="flex justify-between text-white/85"><span>GUN · {spec.gun.name}</span><span className="font-mono">{spec.gun.ammo}</span></div>
              <div className="flex justify-between text-white/85"><span>{WEAPONS[spec.missile].short} · {WEAPONS[spec.missile].name}</span><span className="font-mono">{spec.missiles}</span></div>
              <div className="flex justify-between text-amber-200"><span>SP · {WEAPONS[spec.special].name}</span><span className="font-mono">{spec.specialAmmo}</span></div>
              <div className="flex justify-between text-white/85"><span>Flares</span><span className="font-mono">{spec.flares}</span></div>
              <p className="text-white/45 text-xs">
                {WEAPONS[spec.special].multiLock > 1 ? `Locks up to ${WEAPONS[spec.special].multiLock} targets. ` : ''}
                {WEAPONS[spec.special].air && WEAPONS[spec.special].ground ? 'Air & ground.' : WEAPONS[spec.special].air ? 'Air targets only.' : 'Ground targets only.'}
              </p>
            </div>
            <div className="mt-auto">
              <MenuButton primary onClick={launch}>Launch ▸</MenuButton>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export const PauseMenu = () => {
  const { setShowSettings, mode, aircraft, difficulty, setScreen } = useGameStore();
  const [showControls, setShowControls] = useState(false);
  const engine = getEngine();
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <Panel className="p-8 w-full max-w-sm">
        <Heading sub="Paused">Mission Hold</Heading>
        <div className="flex flex-col gap-2">
          <MenuButton primary onClick={() => engine?.resume()}>Resume</MenuButton>
          <MenuButton onClick={() => engine?.startMission({ mode, aircraft, difficulty })}>Restart Mission</MenuButton>
          <MenuButton onClick={() => setShowControls(true)}>Flight Manual</MenuButton>
          <MenuButton onClick={() => setShowSettings(true)}>Settings</MenuButton>
          <MenuButton onClick={() => { engine?.quitToMenu(); setScreen('MENU'); }}>Abort Mission</MenuButton>
        </div>
      </Panel>
      {showControls && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowControls(false)}>
          <Panel className="w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6"><ControlsHelp /></Panel>
        </div>
      )}
    </div>
  );
};

export const Results = () => {
  const { result, setScreen } = useGameStore();
  if (!result) return null;
  const engine = getEngine();
  const acc = result.shotsFired ? Math.round((result.hits / result.shotsFired) * 100) : 0;
  const ok = result.success;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <Panel className="w-full max-w-2xl p-8">
        <div className={`text-xs uppercase tracking-[0.4em] ${ok ? 'text-emerald-300' : 'text-red-400'}`}>{MISSIONS[result.mode].title}</div>
        <div className="flex items-end justify-between gap-6 mt-2">
          <div>
            <h2 className={`font-display text-4xl sm:text-5xl font-bold uppercase ${ok ? 'text-white' : 'text-red-400'}`}>{ok ? 'Mission Accomplished' : 'Mission Failed'}</h2>
            <p className="text-white/60 mt-1">{result.reason}</p>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-white/50">Rank</div>
            <div className={`font-display text-7xl font-bold leading-none ${result.rank === 'S' ? 'text-amber-300' : 'text-white'}`}>{result.rank}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
          {[
            ['Score', result.score.toLocaleString()],
            ['Time', formatTime(result.time)],
            ['Aircraft', AIRCRAFT[result.aircraft].short],
            ['Air kills', `${result.airKills}`],
            ['Ground kills', `${result.groundKills}`],
            ['Accuracy', `${acc}%`],
          ].map(([k, v]) => (
            <div key={k} className="bg-white/5 border border-white/10 p-3">
              <div className="text-[10px] uppercase tracking-widest text-white/50">{k}</div>
              <div className="font-mono text-xl text-white mt-1">{v}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-8">
          <MenuButton primary onClick={() => engine?.startMission({ mode: result.mode, aircraft: result.aircraft, difficulty: useGameStore.getState().difficulty })}>Retry</MenuButton>
          <MenuButton onClick={() => { engine?.quitToMenu(); setScreen('HANGAR'); }}>Change Aircraft</MenuButton>
          <MenuButton onClick={() => { engine?.quitToMenu(); setScreen('MENU'); }}>Main Menu</MenuButton>
        </div>
      </Panel>
    </div>
  );
};

export const SettingsHost = () => {
  const { showSettings, setShowSettings } = useGameStore();
  return showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null;
};
