import { DEFAULT_RESOURCE_TYPES, HEADER_APPEND_ALLOWLIST, REQUEST_METHODS } from './constants';
import type {
  ModierHeadersProfile,
  ModierHeadersRule,
  ModierHeadersState,
  RequestMethod,
  ResourceType,
  ValidationIssue,
} from './types';

const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeHeaderName(headerName: string): string {
  return headerName.trim().toLowerCase();
}

export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateRule(rule: ModierHeadersRule, path = 'rule'): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!rule.name.trim()) {
    issues.push({ path: `${path}.name`, message: 'Rule name is required.' });
  }

  const hasMatcher =
    rule.target.allUrls ||
    Boolean(rule.target.urlFilter.trim()) ||
    Boolean(rule.target.regexFilter.trim()) ||
    rule.target.requestDomains.length > 0;

  if (!hasMatcher) {
    issues.push({
      path: `${path}.target`,
      message: 'Choose all URLs or provide a URL filter, regex filter, or domain.',
    });
  }

  if (rule.target.regexFilter.trim()) {
    try {
      new RegExp(rule.target.regexFilter);
    } catch {
      issues.push({ path: `${path}.target.regexFilter`, message: 'Regex filter is not valid.' });
    }
  }

  rule.target.requestDomains.forEach((domain, index) => {
    if (!DOMAIN_RE.test(domain)) {
      issues.push({
        path: `${path}.target.requestDomains.${index}`,
        message: `Invalid domain: ${domain}`,
      });
    }
  });

  rule.target.resourceTypes.forEach((resourceType, index) => {
    if (!DEFAULT_RESOURCE_TYPES.includes(resourceType as ResourceType)) {
      issues.push({
        path: `${path}.target.resourceTypes.${index}`,
        message: `Unsupported resource type: ${resourceType}`,
      });
    }
  });

  rule.target.requestMethods.forEach((method, index) => {
    if (!REQUEST_METHODS.includes(method as RequestMethod)) {
      issues.push({
        path: `${path}.target.requestMethods.${index}`,
        message: `Unsupported request method: ${method}`,
      });
    }
  });

  if (rule.kind === 'redirect') {
    if (!rule.target.regexFilter.trim()) {
      issues.push({
        path: `${path}.target.regexFilter`,
        message: 'Redirect rules require a regex filter.',
      });
    }
    if (!rule.redirectRegexSubstitution.trim()) {
      issues.push({
        path: `${path}.redirectRegexSubstitution`,
        message: 'Redirect rules require a regex substitution.',
      });
    }
    return issues;
  }

  const headerName = normalizeHeaderName(rule.headerName);
  if (!headerName || !HEADER_NAME_RE.test(headerName)) {
    issues.push({ path: `${path}.headerName`, message: 'Header name is invalid.' });
  }

  if (rule.operation !== 'remove' && rule.headerValue.length === 0) {
    issues.push({
      path: `${path}.headerValue`,
      message: 'Set and append operations require a value.',
    });
  }

  if (rule.kind === 'requestHeader' && rule.operation === 'append' && !HEADER_APPEND_ALLOWLIST.has(headerName)) {
    issues.push({
      path: `${path}.operation`,
      message: `Chrome MV3 cannot append to request header "${headerName}". Use set or remove.`,
    });
  }

  return issues;
}

export function validateProfile(profile: ModierHeadersProfile, path = 'profile'): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!profile.name.trim()) {
    issues.push({ path: `${path}.name`, message: 'Profile name is required.' });
  }
  profile.rules.forEach((rule, index) => {
    issues.push(...validateRule(rule, `${path}.rules.${index}`));
  });
  return issues;
}

export function validateState(state: ModierHeadersState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (state.version !== 1) {
    issues.push({ path: 'version', message: 'Unsupported state version.' });
  }
  if (state.profiles.length === 0) {
    issues.push({ path: 'profiles', message: 'At least one profile is required.' });
  }
  if (!state.profiles.some((profile) => profile.id === state.activeProfileId)) {
    issues.push({ path: 'activeProfileId', message: 'Active profile does not exist.' });
  }
  state.profiles.forEach((profile, index) => {
    issues.push(...validateProfile(profile, `profiles.${index}`));
  });
  return issues;
}
