import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/shared/defaults';
import { createExportPayload, parseImportPayload } from '../src/shared/exporter';

describe('exporter', () => {
  it('round-trips modierHeaders state', () => {
    const state = createDefaultState();
    const payload = createExportPayload(state);

    expect(parseImportPayload(JSON.parse(JSON.stringify(payload)))).toEqual(state);
  });

  it('accepts legacy CleanHeader exports', () => {
    const state = createDefaultState();
    const payload = createExportPayload(state);

    expect(parseImportPayload({ ...payload, app: 'CleanHeader' })).toEqual(state);
  });

  it('rejects non-modierHeaders payloads', () => {
    expect(() => parseImportPayload({ schema: 'other' })).toThrow(/modierHeaders/);
  });
});
