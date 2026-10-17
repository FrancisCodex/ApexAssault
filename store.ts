import { create } from 'zustand';
import type { AircraftId } from './game/data/aircraft';
import {
  DEFAULT_SETTINGS,
  type Banner, type Difficulty, type MissionMode, type MissionResult, type Objective,
  type RadioMessage, type Settings,
} from './game/data/types';

export type Screen = 'LOADING' | 'MENU' | 'MISSIONS' | 'HANGAR' | 'PLAYING' | 'PAUSED' | 'RESULTS';

const SETTINGS_KEY = 'apex-assault-settings-v2';
const RECORDS_KEY = 'apex-assault-records-v2';

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

export type Records = Partial<Record<MissionMode, { score: number; rank: string; aircraft: AircraftId }>>;

interface Store {
  screen: Screen;
  mode: MissionMode;
  aircraft: AircraftId;
  difficulty: Difficulty;
  settings: Settings;
  objectives: Objective[];
  radio: RadioMessage[];
  banner: Banner | null;
  result: MissionResult | null;
  records: Records;
  missionTitle: string;
  showSettings: boolean;

  setScreen: (s: Screen) => void;
  setMode: (m: MissionMode) => void;
  setAircraft: (a: AircraftId) => void;
  setDifficulty: (d: Difficulty) => void;
  updateSettings: (s: Partial<Settings>) => void;
  setObjectives: (o: Objective[]) => void;
  pushRadio: (m: Omit<RadioMessage, 'id' | 'time'>) => void;
  setBanner: (b: Omit<Banner, 'id'> | null) => void;
  setResult: (r: MissionResult) => void;
  setMissionTitle: (t: string) => void;
  setShowSettings: (v: boolean) => void;
  resetMissionUi: () => void;
}

let radioId = 0;
let bannerId = 0;

export const useGameStore = create<Store>((set, get) => ({
  screen: 'LOADING',
  mode: 'ATTACK',
  aircraft: 'F14',
  difficulty: 'NORMAL',
  settings: load(SETTINGS_KEY, DEFAULT_SETTINGS),
  objectives: [],
  radio: [],
  banner: null,
  result: null,
  records: load<Records>(RECORDS_KEY, {}),
  missionTitle: '',
  showSettings: false,

  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setAircraft: (aircraft) => set({ aircraft }),
  setDifficulty: (difficulty) => set({ difficulty }),
  updateSettings: (s) => {
    const settings = { ...get().settings, ...s };
    save(SETTINGS_KEY, settings);
    set({ settings });
  },
  setObjectives: (objectives) => set({ objectives: objectives.map((o) => ({ ...o })) }),
  pushRadio: (m) => set((st) => ({
    radio: [...st.radio, { ...m, id: ++radioId, time: performance.now() }].slice(-5),
  })),
  setBanner: (b) => set({ banner: b ? { ...b, id: ++bannerId } : null }),
  setResult: (result) => {
    const records = { ...get().records };
    const prev = records[result.mode];
    if (result.success && (!prev || result.score > prev.score)) {
      records[result.mode] = { score: result.score, rank: result.rank, aircraft: result.aircraft };
      save(RECORDS_KEY, records);
    }
    set({ result, records });
  },
  setMissionTitle: (missionTitle) => set({ missionTitle }),
  setShowSettings: (showSettings) => set({ showSettings }),
  resetMissionUi: () => set({ objectives: [], radio: [], banner: null, result: null }),
}));
