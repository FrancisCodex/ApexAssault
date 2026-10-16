import React from 'react';

const ROWS: [string, string, string][] = [
  ['Pitch (nose down / up)', 'W / S', 'Left stick ↕'],
  ['Roll / bank-turn', 'A / D', 'Left stick ↔'],
  ['Yaw (rudder)', 'Q / E', 'LB / RB'],
  ['Accelerate / afterburner', 'Shift', 'RT'],
  ['Brake / airbrake', 'Space', 'LT'],
  ['High-G turn (post-stall)', 'Shift + Space + pull', 'RT + LT + pull'],
  ['Gun', 'Left mouse / J', 'X'],
  ['Fire missile / special', 'Right mouse / K', 'A'],
  ['Switch MSL ⇄ special weapon', 'R', 'Y'],
  ['Switch target', 'Tab / T', 'B'],
  ['Flares', 'F', 'D-pad ↓'],
  ['Look at target (hold)', 'C', 'R3'],
  ['Look back (hold)', 'X', 'L3'],
  ['Free look', 'Mouse / Arrow keys', 'Right stick'],
  ['Change camera (3rd / far / cockpit / HUD)', 'V', 'View'],
  ['Tactical map', 'M', '—'],
  ['Pause', 'Esc / P', 'Menu'],
];

export const ControlsHelp = () => (
  <div>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-widest text-white/45">
          <th className="py-2 font-normal">Action</th>
          <th className="py-2 font-normal">Keyboard / Mouse</th>
          <th className="py-2 font-normal">Gamepad</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(([a, k, g]) => (
          <tr key={a} className="border-t border-white/5">
            <td className="py-1.5 pr-3 text-white/80">{a}</td>
            <td className="py-1.5 pr-3 font-mono text-amber-200 text-xs">{k}</td>
            <td className="py-1.5 font-mono text-emerald-200/80 text-xs">{g}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="text-white/50 text-xs mt-4 leading-relaxed">
      Click the screen once in flight to capture the mouse. Helicopter: Shift / Space raise and lower the collective,
      W / S tilt forward / back, A / D slide sideways, Q / E turn. Low flying keeps you under SAM radar and terrain blocks
      their line of sight. Missiles can be dodged with a hard break turn or by dropping flares at the right moment.
    </p>
  </div>
);
