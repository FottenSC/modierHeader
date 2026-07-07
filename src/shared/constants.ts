import type { HeaderName } from './types';

export const APP_NAME = 'CleanHeader';
export const STORAGE_KEY = 'cleanheaderState';
export const EXPORT_SCHEMA = 'cleanheader.export.v1';

export const DEFAULT_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'media',
  'websocket',
  'other',
] as const;

export const REQUEST_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

export const HEADER_APPEND_ALLOWLIST = new Set<HeaderName>([
  'accept',
  'accept-encoding',
  'accept-language',
  'access-control-request-headers',
  'cache-control',
  'connection',
  'content-language',
  'cookie',
  'forwarded',
  'if-match',
  'if-none-match',
  'keep-alive',
  'range',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via',
  'want-digest',
  'x-forwarded-for',
]);
