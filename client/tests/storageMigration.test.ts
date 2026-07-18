import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearMigratedStorageItems,
  readMigratedJsonItem,
  readMigratedStorageItem,
  STORAGE_KEY_MIGRATIONS,
  writeCurrentStorageItem,
} from '../src/lib/storageMigration.js';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

describe('PRAXON storage migration', () => {
  it('migrates legacy saved reports without deleting the legacy key', () => {
    const storage = new MemoryStorage();
    const reports = [{ schemaVersion: 1, id: 'report-1' }];
    storage.setItem('hotpulse.savedReports.v1', JSON.stringify(reports));

    const restored = readMigratedJsonItem(
      storage,
      STORAGE_KEY_MIGRATIONS.savedReports,
      Array.isArray,
    );

    assert.deepEqual(restored, reports);
    assert.equal(storage.getItem('praxon.savedReports.v1'), JSON.stringify(reports));
    assert.equal(storage.getItem('hotpulse.savedReports.v1'), JSON.stringify(reports));
  });

  it('migrates legacy advisor profile and result data', () => {
    const storage = new MemoryStorage();
    const profile = { productType: 'AI 工具', targetMarket: 'Japan' };
    const result = { recommendations: [{ id: 'opp-1' }] };
    storage.setItem('hotpulse_advisor_profile', JSON.stringify(profile));
    storage.setItem('hotpulse_advisor_result', JSON.stringify(result));

    assert.deepEqual(
      readMigratedJsonItem(storage, STORAGE_KEY_MIGRATIONS.advisorProfile, isRecord),
      profile,
    );
    assert.deepEqual(
      readMigratedJsonItem(storage, STORAGE_KEY_MIGRATIONS.advisorResult, isRecord),
      result,
    );
    assert.equal(storage.getItem('praxon.advisor.profile.v1'), JSON.stringify(profile));
    assert.equal(storage.getItem('praxon.advisor.result.v1'), JSON.stringify(result));
    assert.equal(storage.getItem('hotpulse_advisor_profile'), JSON.stringify(profile));
    assert.equal(storage.getItem('hotpulse_advisor_result'), JSON.stringify(result));
  });

  it('migrates the legacy opportunities cache', () => {
    const storage = new MemoryStorage();
    const cache = { real: { source: 'real', opportunities: [], retrievedAt: '2026-07-18T00:00:00.000Z' } };
    storage.setItem('hotpulse.opportunitiesCache.v1', JSON.stringify(cache));

    const restored = readMigratedJsonItem(
      storage,
      STORAGE_KEY_MIGRATIONS.opportunitiesCache,
      isRecord,
    );

    assert.deepEqual(restored, cache);
    assert.equal(storage.getItem('praxon.opportunitiesCache.v1'), JSON.stringify(cache));
    assert.equal(storage.getItem('hotpulse.opportunitiesCache.v1'), JSON.stringify(cache));
  });

  it('migrates legacy return state fields', () => {
    const storage = new MemoryStorage();
    storage.setItem('hotpulse_return_scroll_y', '420');
    storage.setItem('hotpulse_return_path', '/opportunities?source=real');
    storage.setItem('hotpulse_return_item_id', 'opp-42');

    assert.equal(readMigratedStorageItem(storage, STORAGE_KEY_MIGRATIONS.returnScrollY), '420');
    assert.equal(readMigratedStorageItem(storage, STORAGE_KEY_MIGRATIONS.returnPath), '/opportunities?source=real');
    assert.equal(readMigratedStorageItem(storage, STORAGE_KEY_MIGRATIONS.returnItemId), 'opp-42');
    assert.equal(storage.getItem('praxon.return.scrollY'), '420');
    assert.equal(storage.getItem('praxon.return.path'), '/opportunities?source=real');
    assert.equal(storage.getItem('praxon.return.itemId'), 'opp-42');
  });

  it('never overwrites an existing new key with a legacy value', () => {
    const storage = new MemoryStorage();
    storage.setItem('praxon.analyze.query', 'new query');
    storage.setItem('hotpulse_analyze_query', 'legacy query');

    assert.equal(readMigratedStorageItem(storage, STORAGE_KEY_MIGRATIONS.analyzeQuery), 'new query');
    assert.equal(storage.getItem('praxon.analyze.query'), 'new query');
  });

  it('writes new data only to the PRAXON key', () => {
    const storage = new MemoryStorage();
    assert.equal(writeCurrentStorageItem(storage, STORAGE_KEY_MIGRATIONS.analyzeQuery, 'next query'), true);
    assert.equal(storage.getItem('praxon.analyze.query'), 'next query');
    assert.equal(storage.getItem('hotpulse_analyze_query'), null);
  });

  it('clears current and legacy keys only for an explicit reset', () => {
    const storage = new MemoryStorage();
    storage.setItem('praxon.advisor.profile.v1', '{"productType":"AI 工具"}');
    storage.setItem('hotpulse_advisor_profile', '{"productType":"旧画像"}');
    storage.setItem('hotpulse.advisor.form', '{"productType":"更早画像"}');

    clearMigratedStorageItems(storage, STORAGE_KEY_MIGRATIONS.advisorProfile);

    assert.equal(storage.getItem('praxon.advisor.profile.v1'), null);
    assert.equal(storage.getItem('hotpulse_advisor_profile'), null);
    assert.equal(storage.getItem('hotpulse.advisor.form'), null);
  });
});
