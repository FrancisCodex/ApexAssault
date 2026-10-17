import type { Engine } from './Engine';

let current: Engine | null = null;

export const setEngine = (e: Engine | null) => { current = e; };
export const getEngine = () => current;
