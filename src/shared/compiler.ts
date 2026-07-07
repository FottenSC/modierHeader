import { DEFAULT_RESOURCE_TYPES } from './constants';
import { normalizeHeaderName, validateState } from './validation';
import type {
  CleanHeaderRule,
  CleanHeaderState,
  CompileResult,
  DnrHeaderOperation,
  DnrRule,
} from './types';

function toHeaderOperation(rule: CleanHeaderRule): DnrHeaderOperation {
  const operation: DnrHeaderOperation = {
    header: normalizeHeaderName(rule.headerName),
    operation: rule.operation,
  };
  if (rule.operation !== 'remove') {
    operation.value = rule.headerValue;
  }
  return operation;
}

function toCondition(rule: CleanHeaderRule): DnrRule['condition'] {
  const condition: DnrRule['condition'] = {
    resourceTypes:
      rule.target.resourceTypes.length > 0 ? rule.target.resourceTypes : [...DEFAULT_RESOURCE_TYPES],
  };

  if (!rule.target.allUrls) {
    if (rule.target.regexFilter.trim()) {
      condition.regexFilter = rule.target.regexFilter.trim();
    } else if (rule.target.urlFilter.trim()) {
      condition.urlFilter = rule.target.urlFilter.trim();
    }
    if (rule.target.requestDomains.length > 0) {
      condition.requestDomains = rule.target.requestDomains;
    }
  }

  if (rule.target.requestMethods.length > 0) {
    condition.requestMethods = rule.target.requestMethods;
  }

  return condition;
}

function toDnrRule(rule: CleanHeaderRule, ruleId: number): DnrRule {
  if (rule.kind === 'redirect') {
    return {
      id: ruleId,
      priority: ruleId,
      action: {
        type: 'redirect',
        redirect: {
          regexSubstitution: rule.redirectRegexSubstitution.trim(),
        },
      },
      condition: toCondition(rule),
    };
  }

  const headerOperation = toHeaderOperation(rule);
  return {
    id: ruleId,
    priority: ruleId,
    action: {
      type: 'modifyHeaders',
      ...(rule.kind === 'requestHeader'
        ? { requestHeaders: [headerOperation] }
        : { responseHeaders: [headerOperation] }),
    },
    condition: toCondition(rule),
  };
}

export function compileStateToDnr(state: CleanHeaderState): CompileResult {
  const issues = validateState(state);
  if (issues.length > 0 || !state.enabled) {
    return { rules: [], issues };
  }

  const profileIndex = state.profiles.findIndex((profile) => profile.id === state.activeProfileId);
  const profile = state.profiles[profileIndex];
  if (!profile || !profile.enabled) {
    return { rules: [], issues: [] };
  }

  const rules = profile.rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.enabled)
    .map(({ rule, index }) => toDnrRule(rule, (profileIndex + 1) * 100000 + index + 1));

  return { rules, issues: [] };
}

export function countEnabledRules(state: CleanHeaderState): number {
  if (!state.enabled) return 0;
  const profile = state.profiles.find((item) => item.id === state.activeProfileId);
  if (!profile?.enabled) return 0;
  return profile.rules.filter((rule) => rule.enabled).length;
}
