import { browser } from 'wxt/browser';
import { STORAGE_KEY } from './constants';
import { createDefaultState } from './defaults';
import { validateState } from './validation';
import type { CleanHeaderState } from './types';

export async function getState(): Promise<CleanHeaderState> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const state = stored[STORAGE_KEY] as CleanHeaderState | undefined;
  if (!state) {
    const defaultState = createDefaultState();
    await setState(defaultState);
    return defaultState;
  }
  return state;
}

export async function setState(state: CleanHeaderState): Promise<void> {
  const issues = validateState(state);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function patchState(mutator: (state: CleanHeaderState) => CleanHeaderState): Promise<CleanHeaderState> {
  const current = await getState();
  const next = mutator(current);
  await setState(next);
  return next;
}
