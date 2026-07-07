import type { CleanHeaderProfile, CleanHeaderRule, CleanHeaderState } from './types';

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyRule(partial: Partial<CleanHeaderRule> = {}): CleanHeaderRule {
  return {
    id: createId('rule'),
    name: 'New rule',
    enabled: true,
    kind: 'requestHeader',
    operation: 'set',
    headerName: 'x-cleanheader-demo',
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

export function createProfile(name = 'Default'): CleanHeaderProfile {
  return {
    id: createId('profile'),
    name,
    enabled: true,
    rules: [],
  };
}

export function createDefaultState(): CleanHeaderState {
  const profile = createProfile();
  return {
    version: 1,
    enabled: true,
    activeProfileId: profile.id,
    profiles: [profile],
  };
}
