import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { APPLY_RULES_MESSAGE, OPEN_OPTIONS_MESSAGE, type ModierHeadersMessage } from '../src/shared/messages';
import { STORAGE_KEY } from '../src/shared/constants';
import { compileStateToDnr } from '../src/shared/compiler';
import { getState, setState } from '../src/shared/storage';
import type { ApplyDiagnostics, DnrRule } from '../src/shared/types';

async function assertRegexSupport(rules: DnrRule[]): Promise<void> {
  const dnr = browser.declarativeNetRequest as typeof browser.declarativeNetRequest & {
    isRegexSupported?: (regexOptions: { regex: string }) => Promise<{ isSupported: boolean; reason?: string }>;
  };

  if (!dnr.isRegexSupported) return;

  for (const rule of rules) {
    const regex = rule.condition.regexFilter;
    if (!regex) continue;
    const result = await dnr.isRegexSupported({ regex });
    if (!result.isSupported) {
      throw new Error(`Regex is not supported by this browser: ${regex} (${result.reason ?? 'unknown reason'})`);
    }
  }
}

let applying = false;

async function applyRules(): Promise<ApplyDiagnostics> {
  if (applying) {
    return {
      ok: true,
      ruleCount: 0,
      message: 'Apply already in progress.',
      updatedAt: new Date().toISOString(),
    };
  }

  applying = true;
  let diagnostics: ApplyDiagnostics;

  try {
    const state = await getState();
    const compiled = compileStateToDnr(state);

    if (compiled.issues.length > 0) {
      throw new Error(compiled.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
    }

    await assertRegexSupport(compiled.rules);
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((rule) => rule.id),
      addRules: compiled.rules as never[],
    });

    diagnostics = {
      ok: true,
      ruleCount: compiled.rules.length,
      message: `Applied ${compiled.rules.length} dynamic rule(s).`,
      updatedAt: new Date().toISOString(),
    };
    await setState({ ...state, lastApply: diagnostics });
    return diagnostics;
  } catch (error) {
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((rule) => rule.id),
      addRules: [],
    });
    diagnostics = {
      ok: false,
      ruleCount: 0,
      message: error instanceof Error ? error.message : String(error),
      updatedAt: new Date().toISOString(),
    };
    const state = await getState();
    await setState({ ...state, lastApply: diagnostics });
    return diagnostics;
  } finally {
    applying = false;
  }
}

export default defineBackground({
  type: 'module',
  main() {
    browser.runtime.onInstalled.addListener(() => {
      getState()
        .then(() => applyRules())
        .catch(console.error);
    });

    browser.runtime.onStartup.addListener(() => {
      applyRules().catch(console.error);
    });

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY] || applying) return;
      applyRules().catch(console.error);
    });

    browser.runtime.onMessage.addListener((message: ModierHeadersMessage) => {
      if (message?.type === APPLY_RULES_MESSAGE) {
        return applyRules();
      }
      if (message?.type === OPEN_OPTIONS_MESSAGE) {
        return browser.runtime.openOptionsPage();
      }
      return undefined;
    });
  },
});
