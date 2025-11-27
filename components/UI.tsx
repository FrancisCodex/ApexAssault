import React, { useState, useRef } from 'react';
import { useGameStore } from '../store';
import { PLANE_STATS, PlaneType } from '../types';
import { Crosshair, ShieldAlert, Zap, Plane, Activity, Pause, Play, LogOut, Settings as SettingsIcon, Volume2, Eye, Gamepad2, X, RefreshCw, Trophy } from 'lucide-react';

export const StartScreen = () => {
  const { selectPlane, selectedPlane, startGame, lastResult } = useGameStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-white backdrop-blur-sm">
      <div className="max-w-4xl w-full p-8 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl relative flex flex-col">
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>

        <h1 className="text-6xl font-black text-center mb-4 tracking-tighter italic bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
          APEX ASSAULT
        </h1>

        <p className="text-center text-zinc-400 text-sm mb-4">Made by <a href="https://github.com/FrancisCodex" className="text-blue-400 font-bold hover:underline" target="_blank">@FrancisCodex</a></p>


        {/* Scoreboard / Last Mission Report */}
        {lastResult && (
          <div className="mb-6 mx-auto bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 w-full max-w-lg flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-3">
              <Trophy className="text-yellow-500 w-8 h-8" />
              <div>
                <div className="text-xs text-zinc-400 uppercase font-bold">Last Mission Report</div>
                <div className="font-bold text-white">{lastResult.plane}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-zinc-400">Score: <span className="text-yellow-400 font-mono text-lg">{lastResult.score}</span></div>
              <div className="text-sm text-zinc-400">Wave: <span className="text-white font-mono text-lg">{lastResult.wave}</span></div>
            </div>
          </div>
        )}

        <h3 className="text-center text-zinc-500 uppercase tracking-widest text-sm mb-4">Select Aircraft</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {(['FIGHTER', 'PROPELLER', 'HELICOPTER'] as PlaneType[]).map((type) => {
            const stats = PLANE_STATS[type];
            const isSelected = selectedPlane === type;
            return (
              <div
                key={type}
                onClick={() => selectPlane(type)}
                className={`cursor-pointer p-4 rounded-lg border-2 transition-all duration-300 ${isSelected ? 'border-blue-500 bg-blue-900/20 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'}`}
              >
                <h3 className="text-xl font-bold mb-2 text-center">{stats.name}</h3>
                <div className="space-y-2 text-sm text-zinc-300">
                  <div className="flex justify-between"><span>Speed</span><div className="w-20 bg-zinc-700 h-2 rounded overflow-hidden"><div className="bg-blue-400 h-full" style={{ width: `${stats.speed * 80}%` }}></div></div></div>
                  <div className="flex justify-between"><span>Turn</span><div className="w-20 bg-zinc-700 h-2 rounded overflow-hidden"><div className="bg-green-400 h-full" style={{ width: `${stats.turnSpeed * 20}%` }}></div></div></div>
                  <div className="flex justify-between"><span>Health</span><div className="w-20 bg-zinc-700 h-2 rounded overflow-hidden"><div className="bg-red-400 h-full" style={{ width: `${stats.health}%` }}></div></div></div>
                  <div className="flex justify-between"><span>Damage</span><div className="w-20 bg-zinc-700 h-2 rounded overflow-hidden"><div className="bg-orange-400 h-full" style={{ width: `${stats.damage * 4}%` }}></div></div></div>
                </div>
                <p className="mt-4 text-xs italic text-zinc-500 text-center">{stats.description}</p>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={startGame}
            className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-2xl rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all hover:scale-105 active:scale-95"
          >
            LAUNCH MISSION
          </button>
        </div>
      </div>

      {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} />}
    </div>
  );
};

const SettingsMenu = ({ onClose }: { onClose: () => void }) => {
  const { settings, updateSettings } = useGameStore();
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'VISUAL' | 'AUDIO'>('CONTROLS');

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-zinc-800 border border-zinc-600 rounded-xl w-[600px] h-[500px] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-2xl font-bold text-white">SETTINGS</h2>
          <button onClick={onClose}><X className="text-zinc-400 hover:text-white" /></button>
        </div>

        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setActiveTab('CONTROLS')}
            className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 ${activeTab === 'CONTROLS' ? 'bg-zinc-700 text-blue-400' : 'text-zinc-400 hover:bg-zinc-700/50'}`}
          >
            <Gamepad2 className="w-4 h-4" /> CONTROLS
          </button>
          <button
            onClick={() => setActiveTab('VISUAL')}
            className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 ${activeTab === 'VISUAL' ? 'bg-zinc-700 text-blue-400' : 'text-zinc-400 hover:bg-zinc-700/50'}`}
          >
            <Eye className="w-4 h-4" /> VISUAL
          </button>
          <button
            onClick={() => setActiveTab('AUDIO')}
            className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 ${activeTab === 'AUDIO' ? 'bg-zinc-700 text-blue-400' : 'text-zinc-400 hover:bg-zinc-700/50'}`}
          >
            <Volume2 className="w-4 h-4" /> AUDIO
          </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          {activeTab === 'CONTROLS' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white mb-4">Input Method</h3>
              <div
                onClick={() => updateSettings({ controlScheme: 'MOUSE' })}
                className={`p-4 border rounded cursor-pointer transition-all ${settings.controlScheme === 'MOUSE' ? 'border-blue-500 bg-blue-900/20' : 'border-zinc-700 bg-zinc-900'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-white">Mouse Flight (Default)</span>
                  {settings.controlScheme === 'MOUSE' && <span className="text-blue-400 text-sm font-bold">ACTIVE</span>}
                </div>
                <p className="text-sm text-zinc-400">Mouse to Steer • Spacebar to Shoot • W/S to Throttle</p>
              </div>

              <div
                onClick={() => updateSettings({ controlScheme: 'KEYBOARD' })}
                className={`p-4 border rounded cursor-pointer transition-all ${settings.controlScheme === 'KEYBOARD' ? 'border-blue-500 bg-blue-900/20' : 'border-zinc-700 bg-zinc-900'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-white">Keyboard Flight</span>
                  {settings.controlScheme === 'KEYBOARD' && <span className="text-blue-400 text-sm font-bold">ACTIVE</span>}
                </div>
                <p className="text-sm text-zinc-400">Arrow Keys to Steer • Mouse Click to Shoot • W/S to Throttle</p>
              </div>
            </div>
          )}

          {activeTab === 'VISUAL' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-900 rounded border border-zinc-700">
                <span className="font-bold text-white">Volumetric Clouds</span>
                <button
                  onClick={() => updateSettings({ showClouds: !settings.showClouds })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showClouds ? 'bg-blue-600' : 'bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.showClouds ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'AUDIO' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-white">
                  <span>Master Volume</span>
                  <span>{settings.masterVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.masterVolume}
                  onChange={(e) => updateSettings({ masterVolume: parseInt(e.target.value) })}
                  className="w-full accent-blue-500 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const HUD = () => {
  const { playerHealth, maxPlayerHealth, score, wave, status, setIsFiring, skillCooldown, selectedPlane, enemiesKilled, enemiesRemaining, isSkillActive, skillEndTime, skillCharges, flareReadyTime, isWaveTransitioning, warningMessage } = useGameStore();
  const hpPercent = Math.max(0, (playerHealth / maxPlayerHealth) * 100);
  const [timeLeft, setTimeLeft] = useState(0);
  const [flareTimeLeft, setFlareTimeLeft] = useState(0);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const prevKills = useRef(enemiesKilled);

  React.useEffect(() => {
    if (enemiesKilled > prevKills.current) {
      setShowKillConfirm(true);
      const t = setTimeout(() => setShowKillConfirm(false), 1500);
      return () => clearTimeout(t);
    }
    prevKills.current = enemiesKilled;
  }, [enemiesKilled]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (isSkillActive) {
        const diff = Math.max(0, skillEndTime - Date.now());
        setTimeLeft(Math.ceil(diff / 1000));
      } else {
        const diff = Math.max(0, skillCooldown - Date.now());
        setTimeLeft(Math.ceil(diff / 1000));
      }

      const flareDiff = Math.max(0, flareReadyTime - Date.now());
      setFlareTimeLeft(Math.ceil(flareDiff / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [skillCooldown, isSkillActive, skillEndTime, flareReadyTime]);

  const skillName = PLANE_STATS[selectedPlane].skill.name;

  if (status === 'PAUSED') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-black/50 p-2 rounded border border-zinc-700 backdrop-blur-md">
            <ShieldAlert className="text-red-500 w-6 h-6" />
            <div className="w-64 h-4 bg-zinc-800 rounded-full overflow-hidden border border-zinc-600">
              <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300" style={{ width: `${hpPercent}%` }} />
            </div>
            <span className="font-mono font-bold text-white">{Math.ceil(playerHealth)}/{maxPlayerHealth}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="bg-black/50 p-3 rounded border border-zinc-700 backdrop-blur-md text-right">
            <div className="flex flex-col items-end">
              <span className="text-xs text-zinc-400 font-mono">SCORE</span>
              <span className="text-2xl font-black text-yellow-400 font-mono">{score.toLocaleString()}</span>
              <span className="text-xs text-red-400 font-mono mt-1">KILLS: {enemiesKilled}</span>
            </div>
          </div>
          <div className="bg-black/50 p-2 rounded border border-zinc-700 backdrop-blur-md mt-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-lg font-bold text-white">WAVE {wave}</span>
          </div>
          <div className="bg-black/50 p-2 rounded border border-zinc-700 backdrop-blur-md mt-1 flex items-center justify-end gap-2">
            <span className="text-xs text-zinc-400 font-mono uppercase">Enemies</span>
            <span className="text-lg font-bold text-red-400 font-mono">{enemiesRemaining}</span>
          </div>
        </div>
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <Crosshair className="w-10 h-10 text-white/80" />
      </div>

      {/* Skill Indicator */}
      <div className="absolute bottom-6 left-6 pointer-events-auto flex gap-4">
        <div className={`p-4 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${isSkillActive ? 'bg-yellow-900/80 border-yellow-400 animate-pulse' : (timeLeft === 0 ? 'bg-blue-900/80 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-zinc-900/80 border-zinc-700 opacity-70')}`}>
          <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">SKILL (E)</div>
          <div className="text-lg font-black text-white leading-none text-center">{skillName}</div>

          {isSkillActive ? (
            <div className="flex flex-col items-center">
              <div className="text-xl font-black text-yellow-400">ACTIVE</div>
              <div className="text-sm font-mono text-white">{timeLeft}s</div>
              {selectedPlane === 'FIGHTER' && (
                <div className="text-xs font-bold text-red-400 mt-1">{skillCharges} SHOTS LEFT</div>
              )}
            </div>
          ) : (
            timeLeft > 0 ? (
              <div className="text-2xl font-mono font-bold text-red-400">{timeLeft}s</div>
            ) : (
              <div className="text-xl font-bold text-green-400 animate-pulse">READY</div>
            )
          )}
        </div>

        {/* Flare Indicator */}
        <div className={`p-4 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${flareTimeLeft === 0 ? 'bg-orange-900/80 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-zinc-900/80 border-zinc-700 opacity-70'}`}>
          <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">FLARES (F)</div>
          <div className="text-lg font-black text-white leading-none text-center">Countermeasures</div>

          {flareTimeLeft > 0 ? (
            <div className="text-2xl font-mono font-bold text-red-400">{flareTimeLeft}s</div>
          ) : (
            <div className="text-xl font-bold text-orange-400 animate-pulse">READY</div>
          )}
        </div>
      </div>

      {/* Bottom Area - Fire Button & Hints */}
      <div className="flex justify-between items-end w-full">
        <div className="left-[40%] bottom-6 absolute bg-black/30 p-2 rounded text-xs text-white/50 font-mono self-end">
          MOUSE: Steer • SPACE/CLICK: Fire • W/S: Speed • ESC: Pause
        </div>

        {/* BIG FIRE BUTTON */}
        {/* <div className="pointer-events-auto">
          <button
            className="w-24 h-24 rounded-full bg-red-600/80 border-4 border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.5)] active:scale-95 active:bg-red-500 flex items-center justify-center transition-all select-none touch-none hover:bg-red-600"
            onMouseDown={() => setIsFiring(true)}
            onMouseUp={() => setIsFiring(false)}
            onMouseLeave={() => setIsFiring(false)}
            onTouchStart={(e) => { e.preventDefault(); setIsFiring(true); }}
            onTouchEnd={(e) => { e.preventDefault(); setIsFiring(false); }}
          >
            <div className="text-white text-4xl font-black">FIRE</div>
          </button>
        </div> */}
      </div>

      {/* Wave Survived Message */}
      {isWaveTransitioning && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="text-6xl font-black text-green-500 drop-shadow-[0_0_20px_rgba(34,197,94,0.8)] italic tracking-tighter">
            WAVE {wave} SURVIVED
          </div>
          <div className="text-2xl font-bold text-white mt-2 animate-pulse">
            PREPARE FOR NEXT WAVE
          </div>
        </div>
      )}

      {/* Kill Confirmation Popup */}
      {showKillConfirm && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce">
          <div className="text-red-500 font-black text-2xl tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">KILL CONFIRMED</div>
          <div className="text-yellow-400 font-bold text-sm">+100</div>
        </div>
      )}

      {/* Warning Message */}
      {warningMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-16 flex flex-col items-center animate-pulse">
          <div className="text-red-600 font-black text-6xl tracking-widest drop-shadow-[0_0_20px_rgba(220,38,38,1)] border-4 border-red-600 p-4 rounded-lg bg-black/50 backdrop-blur-sm transform -rotate-2">
            {warningMessage}
          </div>
          <div className="text-red-400 font-bold text-xl mt-2 animate-bounce uppercase tracking-[0.5em]">
            CRITICAL ALTITUDE
          </div>
        </div>
      )}

      {/* Wave Info */}
    </div>
  );
};

export const PauseMenu = () => {
  const { resumeGame, quitGame } = useGameStore();
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-700 p-8 rounded-xl shadow-2xl flex flex-col gap-4 w-80">
        <h2 className="text-3xl font-bold text-white text-center mb-4 flex items-center justify-center gap-2">
          <Pause className="w-8 h-8" /> PAUSED
        </h2>

        <button onClick={resumeGame} className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-colors">
          <Play className="w-5 h-5 fill-current" /> CONTINUE
        </button>

        <button onClick={quitGame} className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-700 hover:bg-red-600 text-white rounded font-bold transition-colors">
          <LogOut className="w-5 h-5" /> ABORT MISSION
        </button>
      </div>
    </div>
  )
}

export const GameOverScreen = () => {
  const { resetGame, restartGame, score, wave } = useGameStore();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/40 backdrop-blur-md animate-in fade-in duration-1000">
      <div className="text-center">
        <h1 className="text-9xl font-black text-red-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-tighter mb-4 -rotate-6">WASTED</h1>
        <div className="bg-black/80 p-8 rounded-xl border-2 border-red-500/50 mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">MISSION FAILED</h2>
          <div className="grid grid-cols-2 gap-8 text-left text-xl text-zinc-300">
            <div>Wave Reached:</div><div className="font-mono font-bold text-white text-right">{wave}</div>
            <div>Final Score:</div><div className="font-mono font-bold text-yellow-400 text-right">{score}</div>
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={restartGame}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded transition-colors uppercase tracking-widest"
          >
            <RefreshCw className="w-5 h-5" /> Restart Mission
          </button>
          <button
            onClick={resetGame}
            className="flex items-center gap-2 px-8 py-3 bg-zinc-800 text-white font-bold text-xl rounded hover:bg-zinc-700 transition-colors uppercase tracking-widest"
          >
            <LogOut className="w-5 h-5" /> Return to Base
          </button>
        </div>
      </div>
    </div>
  );
};

export const MissionSuccessScreen = () => {
  const { resetGame, restartGame, score, wave } = useGameStore();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-900/40 backdrop-blur-md animate-in fade-in duration-1000">
      <div className="text-center">
        <h1 className="text-9xl font-black text-blue-400 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-tighter mb-4 -rotate-6">VICTORY</h1>
        <div className="bg-black/80 p-8 rounded-xl border-2 border-blue-500/50 mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">MISSION ACCOMPLISHED</h2>
          <div className="grid grid-cols-2 gap-8 text-left text-xl text-zinc-300">
            <div>Waves Cleared:</div><div className="font-mono font-bold text-white text-right">{wave}</div>
            <div>Final Score:</div><div className="font-mono font-bold text-yellow-400 text-right">{score}</div>
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={restartGame}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded transition-colors uppercase tracking-widest"
          >
            <RefreshCw className="w-5 h-5" /> Replay Mission
          </button>
          <button
            onClick={resetGame}
            className="flex items-center gap-2 px-8 py-3 bg-zinc-800 text-white font-bold text-xl rounded hover:bg-zinc-700 transition-colors uppercase tracking-widest"
          >
            <LogOut className="w-5 h-5" /> Return to Base
          </button>
        </div>
      </div>
    </div>
  );
};