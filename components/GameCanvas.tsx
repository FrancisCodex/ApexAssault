import React, { useEffect, useRef } from 'react';
import { Engine } from '../game/Engine';
import { setEngine } from '../game/engineRef';
import { useGameStore } from '../store';

/** Hosts the WebGL canvas plus the 2D HUD canvas and owns the Engine lifetime. */
export const GameCanvas = () => {
  const glRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLCanvasElement>(null);
  const settings = useGameStore((s) => s.settings);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    if (!glRef.current || !hudRef.current) return;
    // Let the loading screen paint before the (synchronous) terrain build.
    const id = window.setTimeout(() => {
      try {
        const engine = new Engine(glRef.current!, hudRef.current!, useGameStore.getState().settings);
        engineRef.current = engine;
        setEngine(engine);
        useGameStore.getState().setScreen('MENU');
      } catch (err) {
        console.error(err);
        alert('WebGL could not be initialised on this device.');
      }
    }, 60);
    return () => {
      window.clearTimeout(id);
      engineRef.current?.dispose();
      engineRef.current = null;
      setEngine(null);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.applySettings(settings);
  }, [settings]);

  return (
    <div className="absolute inset-0">
      <canvas ref={glRef} className="absolute inset-0 block" />
      <canvas ref={hudRef} className="absolute inset-0 block pointer-events-none" />
    </div>
  );
};
