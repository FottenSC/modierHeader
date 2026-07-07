import type { ModierHeadersProfile, ModierHeadersRule, ModierHeadersState } from './types';

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyRule(partial: Partial<ModierHeadersRule> = {}): ModierHeadersRule {
  return {
    id: createId('rule'),
    name: 'New rule',
    enabled: true,
    kind: 'requestHeader',
    operation: 'set',
    headerName: 'x-modierheaders-demo',
    headerValue: 'enabled',
    redirectRegexSubstitution: '',
    target: {
      allUrls: false,
      urlFilter: '||example.com/',
      regexFilter: '',
      requestDomains: [],
      resourceTypes: ['main_frame', 'xmlhttprequest'],
      requestMethods: [],
    },
    ...partial,
  };
}

export function createProfile(name = 'Default'): ModierHeadersProfile {
  return {
    id: createId('profile'),
    name,
    enabled: true,
    rules: [],
  };
}

export function createDefaultState(): ModierHeadersState {
  const profile = createProfile();
  return {
    version: 1,
    enabled: true,
    activeProfileId: profile.id,
    profiles: [profile],
  };
}
