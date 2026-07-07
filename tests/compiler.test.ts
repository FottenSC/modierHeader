import { describe, expect, it } from 'vitest';
import { compileStateToDnr } from '../src/shared/compiler';
import { createDefaultState, createEmptyRule } from '../src/shared/defaults';

describe('compileStateToDnr', () => {
  it('compiles enabled request header rules', () => {
    const state = createDefaultState();
    state.profiles[0].rules.push(
      createEmptyRule({
        headerName: 'X-Test',
        headerValue: 'ok',
        target: {
          allUrls: false,
          urlFilter: '||example.com/',
          regexFilter: '',
          requestDomains: [],
          resourceTypes: ['xmlhttprequest'],
          requestMethods: ['get'],
        },
      }),
    );

    const result = compileStateToDnr(state);

    expect(result.issues).toEqual([]);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toMatchObject({
      id: 100001,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'x-test', operation: 'set', value: 'ok' }],
      },
      condition: {
        urlFilter: '||example.com/',
        resourceTypes: ['xmlhttprequest'],
        requestMethods: ['get'],
      },
    });
  });

  it('compiles response header rules', () => {
    const state = createDefaultState();
    state.profiles[0].rules.push(
      createEmptyRule({
        kind: 'responseHeader',
        operation: 'remove',
        headerName: 'x-powered-by',
        headerValue: '',
      }),
    );

    const result = compileStateToDnr(state);

    expect(result.issues).toEqual([]);
    expect(result.rules[0].action).toMatchObject({
      type: 'modifyHeaders',
      responseHeaders: [{ header: 'x-powered-by', operation: 'remove' }],
    });
  });

  it('compiles redirect rules with regex substitution', () => {
    const state = createDefaultState();
    state.profiles[0].rules.push(
      createEmptyRule({
        kind: 'redirect',
        redirectRegexSubstitution: 'https://new.example/\\1',
        target: {
          allUrls: false,
          urlFilter: '',
          regexFilter: '^https://old\\.example/(.*)$',
          requestDomains: [],
          resourceTypes: ['main_frame'],
          requestMethods: [],
        },
      }),
    );

    const result = compileStateToDnr(state);

    expect(result.issues).toEqual([]);
    expect(result.rules[0]).toMatchObject({
      action: {
        type: 'redirect',
        redirect: { regexSubstitution: 'https://new.example/\\1' },
      },
      condition: {
        regexFilter: '^https://old\\.example/(.*)$',
      },
    });
  });

  it('returns no rules when extension is disabled', () => {
    const state = createDefaultState();
    state.enabled = false;
    state.profiles[0].rules.push(createEmptyRule());

    expect(compileStateToDnr(state).rules).toEqual([]);
  });
});
