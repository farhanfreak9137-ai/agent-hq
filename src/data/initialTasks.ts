import { TaskModel } from '../types/index.ts';

/**
 * Initial tasks state for production Agent HQ.
 * Starts clean with zero pre-baked demo tasks. Real tasks are assigned by the user or planned by BOSS.
 */
export const INITIAL_TASKS: TaskModel[] = [];
