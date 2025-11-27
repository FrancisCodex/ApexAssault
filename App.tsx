import React from 'react';
import { useGameStore } from './store';
import { GameScene } from './components/GameScene';
import { StartScreen, HUD, GameOverScreen, PauseMenu, MissionSuccessScreen } from './components/UI';
import { Analytics } from "@vercel/analytics/react"
const App = () => {
  const status = useGameStore((state) => state.status);

  return (
    <div className="w-full h-full bg-black relative overflow-hidden select-none">
      {/* 3D Scene Layer */}
      <GameScene />

      {/* UI Overlay Layer */}
      {status === 'MENU' && <StartScreen />}
      {(status === 'PLAYING' || status === 'PAUSED') && <HUD />}
      {status === 'PAUSED' && <PauseMenu />}
      {status === 'GAMEOVER' && <GameOverScreen />}
      {status === 'VICTORY' && <MissionSuccessScreen />}
      <Analytics />
    </div>
  );
};

export default App;