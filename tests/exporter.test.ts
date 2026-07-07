import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/shared/defaults';
import { createExportPayload, parseImportPayload } from '../src/shared/exporter';

describe('exporter', () => {
  it('round-trips CleanHeader state', () => {
    const state = createDefaultState();
    const payload = createExportPayload(state);

    expect(parseImportPayload(JSON.parse(JSON.stringify(payload)))).toEqual(state);
  });

  it('rejects non-CleanHeader payloads', () => {
    expect(() => parseImportPayload({ schema: 'other' })).toThrow(/CleanHeader/);
  });
});
