import { APP_NAME, EXPORT_SCHEMA, LEGACY_EXPORT_SCHEMA } from './constants';
import { validateState } from './validation';
import type { ModierHeadersExport, ModierHeadersState } from './types';

const SUPPORTED_EXPORT_APPS = new Set(['CleanHeader', APP_NAME]);
const SUPPORTED_EXPORT_SCHEMAS = new Set([LEGACY_EXPORT_SCHEMA, EXPORT_SCHEMA]);

export function createExportPayload(state: ModierHeadersState): ModierHeadersExport {
  const issues = validateState(state);
  if (issues.length > 0) {
    throw new Error(`Cannot export invalid state: ${issues.map((issue) => issue.message).join(' ')}`);
  }
  return {
    schema: EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    app: APP_NAME,
    state,
  };
}

export function parseImportPayload(payload: unknown): ModierHeadersState {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Import file must be a JSON object.');
  }

  const candidate = payload as Partial<ModierHeadersExport>;
  if (
    !candidate.schema ||
    !SUPPORTED_EXPORT_SCHEMAS.has(candidate.schema) ||
    !candidate.app ||
    !SUPPORTED_EXPORT_APPS.has(candidate.app) ||
    !candidate.state
  ) {
    throw new Error('Import file is not a modierHeaders v1 export.');
  }

  const issues = validateState(candidate.state);
  if (issues.length > 0) {
    throw new Error(`Import file is invalid: ${issues.map((issue) => issue.message).join(' ')}`);
  }

  return candidate.state;
}
