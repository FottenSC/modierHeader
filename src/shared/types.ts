import type { DEFAULT_RESOURCE_TYPES, REQUEST_METHODS } from './constants';

export type HeaderName = string;
export type HeaderOperation = 'set' | 'append' | 'remove';
export type RuleKind = 'requestHeader' | 'responseHeader' | 'redirect';
export type ResourceType = (typeof DEFAULT_RESOURCE_TYPES)[number];
export type RequestMethod = (typeof REQUEST_METHODS)[number];

export interface RuleTarget {
  allUrls: boolean;
  urlFilter: string;
  regexFilter: string;
  requestDomains: string[];
  resourceTypes: ResourceType[];
  requestMethods: RequestMethod[];
}

export interface CleanHeaderRule {
  id: string;
  name: string;
  enabled: boolean;
  kind: RuleKind;
  operation: HeaderOperation;
  headerName: string;
  headerValue: string;
  redirectRegexSubstitution: string;
  target: RuleTarget;
}

export interface CleanHeaderProfile {
  id: string;
  name: string;
  enabled: boolean;
  rules: CleanHeaderRule[];
}

export interface ApplyDiagnostics {
  ok: boolean;
  ruleCount: number;
  message: string;
  updatedAt: string;
}

export interface CleanHeaderState {
  version: 1;
  enabled: boolean;
  activeProfileId: string;
  profiles: CleanHeaderProfile[];
  lastApply?: ApplyDiagnostics;
}

export interface CleanHeaderExport {
  schema: 'cleanheader.export.v1';
  exportedAt: string;
  app: 'CleanHeader';
  state: CleanHeaderState;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface DnrHeaderOperation {
  header: string;
  operation: HeaderOperation;
  value?: string;
}

export interface DnrRule {
  id: number;
  priority: number;
  action:
    | {
        type: 'modifyHeaders';
        requestHeaders?: DnrHeaderOperation[];
        responseHeaders?: DnrHeaderOperation[];
      }
    | {
        type: 'redirect';
        redirect: {
          regexSubstitution: string;
        };
      };
  condition: {
    urlFilter?: string;
    regexFilter?: string;
    requestDomains?: string[];
    resourceTypes: ResourceType[];
    requestMethods?: RequestMethod[];
  };
}

export interface CompileResult {
  rules: DnrRule[];
  issues: ValidationIssue[];
}
