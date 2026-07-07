import { APP_NAME, EXPORT_SCHEMA } from './constants';
import { validateState } from './validation';
import type { CleanHeaderExport, CleanHeaderState } from './types';

export function createExportPayload(state: CleanHeaderState): CleanHeaderExport {
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

export function parseImportPayload(payload: unknown): CleanHeaderState {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Import file must be a JSON object.');
  }

  const candidate = payload as Partial<CleanHeaderExport>;
  if (candidate.schema !== EXPORT_SCHEMA || candidate.app !== APP_NAME || !candidate.state) {
    throw new Error('Import file is not a CleanHeader v1 export.');
  }

  const issues = validateState(candidate.state);
  if (issues.length > 0) {
    throw new Error(`Import file is invalid: ${issues.map((issue) => issue.message).join(' ')}`);
  }

  return candidate.state;
}
