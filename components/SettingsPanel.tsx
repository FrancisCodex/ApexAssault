import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../store';
import { Panel, Toggle, Segmented, Slider } from './ui';
import type { ControlMode, Quality } from '../game/data/types';
import { ControlsHelp } from './ControlsHelp';

const MODES: { value: ControlMode; label: string; hint: string }[] = [
  { value: 'STANDARD', label: 'Standard', hint: 'Ace Combat style. A/D banks and turns, wings auto-level when released. Best for beginners.' },
  { value: 'EXPERT', label: 'Expert', hint: 'Full manual control. A/D roll freely, no auto-level — required for advanced maneuvers.' },
  { value: 'MOUSE_AIM', label: 'Mouse Aim', hint: 'Point the mouse where you want to fly; the autopilot steers. Keys override for manual maneuvers.' },
];

export const SettingsPanel = ({ onClose }: { onClose: () => void }) => {
  const { settings, updateSettings } = useGameStore();
  const [tab, setTab] = useState<'CONTROLS' | 'GRAPHICS' | 'AUDIO' | 'KEYS'>('CONTROLS');

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <Panel className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="font-display text-2xl uppercase tracking-[0.2em] text-white">Settings</h2>
            <button onClick={onClose} className="text-white/60 hover:text-white" aria-label="Close settings"><X /></button>
          </div>
          <div className="flex border-b border-white/10 overflow-x-auto">
            {(['CONTROLS', 'GRAPHICS', 'AUDIO', 'KEYS'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 px-3 font-display uppercase tracking-[0.2em] text-sm whitespace-nowrap ${tab === t ? 'text-amber-300 border-b-2 border-amber-300 bg-white/5' : 'text-white/50 hover:text-white'}`}
              >
                {t === 'KEYS' ? 'Key Bindings' : t}
              </button>
            ))}
          </div>
          <div className="p-6 overflow-y-auto space-y-3">
            {tab === 'CONTROLS' && (
              <>
                <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Flight control type</div>
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => updateSettings({ controlMode: m.value })}
                    className={`w-full text-left p-3 border transition-colors ${settings.controlMode === m.value ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                  >
                    <div className="flex justify-between">
                      <span className="font-display uppercase tracking-widest text-white">{m.label}</span>
                      {settings.controlMode === m.value && <span className="text-amber-300 text-xs font-bold">ACTIVE</span>}
                    </div>
                    <p className="text-white/55 text-xs mt-1">{m.hint}</p>
                  </button>
                ))}
                <Toggle label="Invert pitch" hint="Off: S / stick back pulls the nose up (flight-sim standard)." value={settings.invertPitch} onChange={(v) => updateSettings({ invertPitch: v })} />
                <Toggle label="Gun aim assist" hint="Bullets bend toward the lead indicator when you are close to it." value={settings.aimAssist} onChange={(v) => updateSettings({ aimAssist: v })} />
                <Slider label="Mouse sensitivity" value={settings.mouseSensitivity} min={0.3} max={2.5} step={0.1} onChange={(v) => updateSettings({ mouseSensitivity: v })} format={(v) => v.toFixed(1)} />
              </>
            )}
            {tab === 'GRAPHICS' && (
              <>
                <div className="p-3 bg-white/5 border border-white/10">
                  <div className="text-sm text-white font-semibold mb-2">Quality preset</div>
                  <Segmented<Quality>
                    value={settings.quality}
                    onChange={(v) => updateSettings({ quality: v })}
                    options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]}
                  />
                  <p className="text-white/50 text-xs mt-2">High enables real-time shadows, denser forests and full-resolution terrain.</p>
                </div>
                <Toggle label="Volumetric-style clouds" value={settings.clouds} onChange={(v) => updateSettings({ clouds: v })} />
                <Toggle label="Bloom" hint="Glow on afterburners, explosions and tracers." value={settings.bloom} onChange={(v) => updateSettings({ bloom: v })} />
                <Toggle label="Rear-view mirror" hint="Picture-in-picture view behind your aircraft." value={settings.rearMirror} onChange={(v) => updateSettings({ rearMirror: v })} />
                <Slider label="Field of view" value={settings.fov} min={50} max={90} onChange={(v) => updateSettings({ fov: v })} format={(v) => `${v}°`} />
              </>
            )}
            {tab === 'AUDIO' && (
              <Slider label="Master volume" value={settings.masterVolume} min={0} max={100} onChange={(v) => updateSettings({ masterVolume: v })} format={(v) => `${v}%`} />
            )}
            {tab === 'KEYS' && <ControlsHelp />}
          </div>
        </div>
      </Panel>
    </div>
  );
};
