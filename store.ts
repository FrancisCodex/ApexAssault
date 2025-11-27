import { create } from 'zustand';
import { GameState, PlaneType, PLANE_STATS, GameStatus, Settings } from './types';

interface Store extends GameState {
  skillCooldown: number;
  setGameStatus: (status: GameStatus) => void;
  selectPlane: (plane: PlaneType) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  quitGame: () => void;
  resetGame: () => void;
  restartGame: () => void;
  updateHealth: (current: number) => void;
  registerKill: (scoreAmount: number) => void;
  nextWave: () => void;
  setEnemiesRemaining: (count: number) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  setIsFiring: (isFiring: boolean) => void;
  isSkillActive: boolean;
  skillEndTime: number;
  skillCharges: number;
  triggerSkill: () => void;
  endSkill: () => void;
  decrementSkillCharge: () => void;
  resetSkill: () => void;
  flareReadyTime: number;
  triggerFlares: () => void;
  playerPosRef: any;
  playerRotRef: any;
  enemiesRef: any;
  setRefs: (playerPosRef: any, playerRotRef: any, enemiesRef: any) => void;
  enemiesRemaining: number;
  isWaveTransitioning: boolean;
  setWaveTransitioning: (isTransitioning: boolean) => void;
  warningMessage: string | null;
  setWarningMessage: (msg: string | null) => void;
}

export const useGameStore = create<Store>((set, get) => ({
  // --- existing fields ----
  status: 'MENU',
  wave: 1,
  score: 0,
  enemiesKilled: 0,
  enemiesRemaining: 0,
  selectedPlane: 'FIGHTER',
  playerHealth: 100,
  maxPlayerHealth: 100,
  isFiring: false,
  skillCooldown: 0,
  isSkillActive: false,
  skillEndTime: 0,
  skillCharges: 0,
  flareReadyTime: 0,
  isWaveTransitioning: false,
  lastResult: null,
  warningMessage: null,
  settings: {
    controlScheme: 'MOUSE',
    showClouds: true,
    masterVolume: 80,
  },

  // --- ADD THESE 3 LINES ---
  playerPosRef: null,
  playerRotRef: null,
  enemiesRef: null,

  // --- ADD THIS FUNCTION ---
  setRefs: (playerPosRef, playerRotRef, enemiesRef) =>
    set({ playerPosRef, playerRotRef, enemiesRef }),

  setGameStatus: (status) => set({ status }),

  setWarningMessage: (msg) => set({ warningMessage: msg }),

  selectPlane: (plane) => set({ selectedPlane: plane }),

  startGame: () => set((state) => {
    const stats = PLANE_STATS[state.selectedPlane];
    return {
      status: 'PLAYING',
      wave: 1,
      score: 0,
      enemiesKilled: 0,
      playerHealth: stats.health,
      maxPlayerHealth: stats.health,
      isFiring: false,
      skillCooldown: 0,
      flareReadyTime: 0,
      isWaveTransitioning: false,
      warningMessage: null,
    };
  }),

  pauseGame: () => set((state) => state.status === 'PLAYING' ? { status: 'PAUSED', isFiring: false } : {}),

  resumeGame: () => set((state) => state.status === 'PAUSED' ? { status: 'PLAYING' } : {}),

  quitGame: () => {
    const state = get();
    const stats = PLANE_STATS[state.selectedPlane];
    set({
      status: 'MENU',
      isFiring: false,
      lastResult: {
        score: state.score,
        wave: state.wave,
        plane: stats.name
      },
      warningMessage: null,
    });
  },

  resetGame: () => {
    const state = get();
    const stats = PLANE_STATS[state.selectedPlane];
    set({
      status: 'MENU',
      isFiring: false,
      lastResult: {
        score: state.score,
        wave: state.wave,
        plane: stats.name
      },
      warningMessage: null,
    });
  },

  restartGame: () => set((state) => {
    const stats = PLANE_STATS[state.selectedPlane];
    return {
      status: 'PLAYING',
      wave: 1,
      score: 0,
      enemiesKilled: 0,
      playerHealth: stats.health,
      maxPlayerHealth: stats.health,
      isFiring: false,
      warningMessage: null,
    };
  }),

  updateHealth: (current) => set({ playerHealth: current }),

  registerKill: (amount) => set((state) => ({
    score: state.score + amount,
    enemiesKilled: state.enemiesKilled + 1
  })),

  nextWave: () => set((state) => ({ wave: state.wave + 1 })),

  setEnemiesRemaining: (count) => set({ enemiesRemaining: count }),

  updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),

  setIsFiring: (isFiring) => set({ isFiring }),

  triggerSkill: () => {
    const state = get();
    if (state.skillCooldown > Date.now() || state.isSkillActive) return;

    const stats = PLANE_STATS[state.selectedPlane];
    set({
      isSkillActive: true,
      skillEndTime: Date.now() + stats.skill.duration,
      skillCharges: stats.skill.maxShots || 0
    });
  },

  endSkill: () => {
    const state = get();
    if (!state.isSkillActive) return;

    const stats = PLANE_STATS[state.selectedPlane];
    set({
      isSkillActive: false,
      skillCooldown: Date.now() + stats.skill.cooldown,
      skillCharges: 0
    });
  },

  decrementSkillCharge: () => {
    const state = get();
    if (state.skillCharges > 0) {
      set({ skillCharges: state.skillCharges - 1 });
    }
  },

  resetSkill: () => set({ skillCooldown: 0 }),

  triggerFlares: () => {
    const state = get();
    if (Date.now() < state.flareReadyTime) return;

    const stats = PLANE_STATS[state.selectedPlane];
    set({ flareReadyTime: Date.now() + stats.flareCooldown });
  },

  setWaveTransitioning: (isTransitioning) => set({ isWaveTransitioning: isTransitioning }),
}));