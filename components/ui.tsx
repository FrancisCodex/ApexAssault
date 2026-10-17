import React from 'react';

/** Shared visual primitives for the menus. */
export const Panel = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={`bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl ${className}`}>{children}</div>
);

export const Heading = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div className="mb-5">
    <div className="text-[11px] tracking-[0.35em] text-amber-300/80 uppercase">{sub}</div>
    <h2 className="font-display text-3xl md:text-4xl font-bold tracking-wide text-white uppercase">{children}</h2>
  </div>
);

export const MenuButton = ({
  children, onClick, primary, disabled, small,
}: { children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; small?: boolean }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`group relative font-display uppercase tracking-[0.2em] text-left transition-all
      ${small ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-lg'}
      ${primary
        ? 'bg-amber-400 text-black hover:bg-amber-300 font-bold'
        : 'bg-white/5 text-white/90 border border-white/15 hover:bg-white/10 hover:border-amber-300/60'}
      ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
  >
    <span className={`absolute left-0 top-0 h-full w-1 ${primary ? 'bg-black/30' : 'bg-amber-300 opacity-0 group-hover:opacity-100'} transition-opacity`} />
    {children}
  </button>
);

export const StatBar = ({ label, value, color = 'bg-emerald-300' }: { label: string; value: number; color?: string }) => (
  <div className="flex items-center gap-3 text-xs">
    <span className="w-20 uppercase tracking-widest text-white/60">{label}</span>
    <div className="flex-1 h-1.5 bg-white/10">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

export const Toggle = ({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
  <button
    onClick={() => onChange(!value)}
    className="w-full flex items-center justify-between gap-4 p-3 bg-white/5 border border-white/10 hover:border-white/25 text-left"
  >
    <span>
      <span className="block text-white text-sm font-semibold">{label}</span>
      {hint && <span className="block text-white/50 text-xs mt-0.5">{hint}</span>}
    </span>
    <span className={`shrink-0 w-11 h-6 p-0.5 transition-colors ${value ? 'bg-amber-400' : 'bg-white/15'}`}>
      <span className={`block w-5 h-5 bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

export const Segmented = <T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
  <div className="flex flex-wrap gap-1">
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 text-xs uppercase tracking-widest font-display border transition-colors
          ${value === o.value ? 'bg-amber-400 text-black border-amber-400 font-bold' : 'bg-white/5 text-white/70 border-white/15 hover:border-white/40'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const Slider = ({ label, value, min, max, step = 1, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
}) => (
  <label className="block p-3 bg-white/5 border border-white/10">
    <span className="flex justify-between text-sm text-white">
      <span className="font-semibold">{label}</span>
      <span className="font-mono text-amber-300">{format ? format(value) : value}</span>
    </span>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full mt-2 accent-amber-400"
    />
  </label>
);
