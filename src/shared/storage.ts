import { browser } from 'wxt/browser';
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from './constants';
import { createDefaultState } from './defaults';
import { validateState } from './validation';
import type { ModierHeadersState } from './types';

export async function getState(): Promise<ModierHeadersState> {
  const stored = await browser.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const state = stored[STORAGE_KEY] as ModierHeadersState | undefined;
  if (state) return state;

  const legacyState = stored[LEGACY_STORAGE_KEY] as ModierHeadersState | undefined;
  if (legacyState) {
    await setState(legacyState);
    return legacyState;
  }

  const defaultState = createDefaultState();
  await setState(defaultState);
  return defaultState;
}

export async function setState(state: ModierHeadersState): Promise<void> {
  const issues = validateState(state);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function patchState(mutator: (state: ModierHeadersState) => ModierHeadersState): Promise<ModierHeadersState> {
  const current = await getState();
  const next = mutator(current);
  await setState(next);
  return next;
}
