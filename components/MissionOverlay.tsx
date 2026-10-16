import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store';

const TONE: Record<string, string> = {
  ally: 'text-sky-300',
  enemy: 'text-red-400',
  command: 'text-amber-300',
  system: 'text-white/70',
};

/** Objectives, radio chatter and mission banners shown over the flight view. */
export const MissionOverlay = () => {
  const { objectives, radio, banner, missionTitle, settings } = useGameStore();
  const [now, setNow] = useState(performance.now());
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!banner) return;
    setBannerVisible(true);
    const id = window.setTimeout(() => setBannerVisible(false), 4200);
    return () => window.clearTimeout(id);
  }, [banner?.id]);

  const recent = radio.filter((m) => now - m.time < 9000).slice(-3);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none">
      <div className="absolute left-4 top-4 max-w-[min(360px,45vw)] bg-black/35 border-l-2 border-amber-400/70 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300/80 font-display">{missionTitle}</div>
        <ul className="mt-1 space-y-0.5">
          {objectives.map((o) => (
            <li key={o.id} className={`text-xs leading-snug flex gap-2 ${o.done ? 'text-emerald-300/80 line-through decoration-emerald-300/40' : o.progress === 'LOCKED' ? 'text-white/35' : 'text-white/90'}`}>
              <span>{o.done ? '✔' : '▸'}</span>
              <span className="flex-1">{o.text}</span>
              {o.progress && !o.done && o.progress !== 'LOCKED' && <span className="font-mono text-amber-200">{o.progress}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 w-[min(640px,90vw)] space-y-1">
        {recent.map((m) => (
          <div key={m.id} className="bg-black/45 px-3 py-1.5 text-sm animate-[fadein_0.3s_ease-out]">
            <span className={`font-display uppercase tracking-widest text-xs mr-2 ${TONE[m.tone]}`}>{m.from}</span>
            <span className="text-white/90">{m.text}</span>
          </div>
        ))}
      </div>

      {banner && bannerVisible && (
        <div key={banner.id} className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center animate-[banner_4.2s_ease-out_forwards]">
          <div className={`font-display text-3xl sm:text-5xl font-bold tracking-[0.18em] uppercase ${banner.tone === 'danger' ? 'text-red-400' : banner.tone === 'success' ? 'text-emerald-300' : 'text-white'}`}
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>
            {banner.title}
          </div>
          {banner.subtitle && <div className="mt-1 text-white/85 tracking-[0.25em] uppercase text-xs sm:text-sm">{banner.subtitle}</div>}
        </div>
      )}

      {settings.controlMode === 'MOUSE_AIM' && (
        <div className="absolute left-4 bottom-4 text-[10px] text-white/35 uppercase tracking-widest">Mouse aim · click to capture cursor</div>
      )}
    </div>
  );
};
