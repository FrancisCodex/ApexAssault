import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { useGameStore } from './store';
import { GameCanvas } from './components/GameCanvas';
import { LoadingScreen, MainMenu, MissionSelect, Hangar, PauseMenu, Results, SettingsHost } from './components/Menus';
import { MissionOverlay } from './components/MissionOverlay';

const App = () => {
  const screen = useGameStore((s) => s.screen);

  return (
    <div className="w-full h-full bg-black relative overflow-hidden select-none font-body">
      <GameCanvas />
      {screen === 'LOADING' && <LoadingScreen />}
      {screen === 'MENU' && <MainMenu />}
      {screen === 'MISSIONS' && <MissionSelect />}
      {screen === 'HANGAR' && <Hangar />}
      {(screen === 'PLAYING' || screen === 'PAUSED') && <MissionOverlay />}
      {screen === 'PAUSED' && <PauseMenu />}
      {screen === 'RESULTS' && <Results />}
      <SettingsHost />
      <Analytics />
    </div>
  );
};

export default App;
