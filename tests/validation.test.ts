import { describe, expect, it } from 'vitest';
import { createDefaultState, createEmptyRule } from '../src/shared/defaults';
import { validateRule, validateState } from '../src/shared/validation';

describe('validation', () => {
  it('rejects invalid header names', () => {
    const rule = createEmptyRule({ headerName: 'bad header' });

    expect(validateRule(rule).map((issue) => issue.path)).toContain('rule.headerName');
  });

  it('rejects redirect rules without regex filters', () => {
    const rule = createEmptyRule({
      kind: 'redirect',
      redirectRegexSubstitution: 'https://new.example',
    });

    expect(validateRule(rule).map((issue) => issue.path)).toContain('rule.target.regexFilter');
  });

  it('rejects unsupported request header append operations', () => {
    const rule = createEmptyRule({
      operation: 'append',
      headerName: 'x-custom-header',
    });

    expect(validateRule(rule).map((issue) => issue.path)).toContain('rule.operation');
  });

  it('accepts default state', () => {
    expect(validateState(createDefaultState())).toEqual([]);
  });
});
