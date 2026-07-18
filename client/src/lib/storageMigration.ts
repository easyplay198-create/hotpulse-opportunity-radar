export interface StorageKeyMigration {
  currentKey: string;
  legacyKeys: readonly string[];
}

export const STORAGE_KEY_MIGRATIONS = {
  advisorProfile: {
    currentKey: 'praxon.advisor.profile.v1',
    legacyKeys: ['hotpulse_advisor_profile', 'hotpulse.advisor.form'],
  },
  advisorResult: {
    currentKey: 'praxon.advisor.result.v1',
    legacyKeys: ['hotpulse_advisor_result', 'hotpulse.advisor.result'],
  },
  savedReports: {
    currentKey: 'praxon.savedReports.v1',
    legacyKeys: ['hotpulse.savedReports.v1'],
  },
  analyzeQuery: {
    currentKey: 'praxon.analyze.query',
    legacyKeys: ['hotpulse_analyze_query'],
  },
  autoRunOnce: {
    currentKey: 'praxon.autoRunOnce',
    legacyKeys: ['hotpulse_auto_run_once'],
  },
  opportunitiesCache: {
    currentKey: 'praxon.opportunitiesCache.v1',
    legacyKeys: ['hotpulse.opportunitiesCache.v1'],
  },
  returnScrollY: {
    currentKey: 'praxon.return.scrollY',
    legacyKeys: ['hotpulse_return_scroll_y'],
  },
  returnPath: {
    currentKey: 'praxon.return.path',
    legacyKeys: ['hotpulse_return_path'],
  },
  returnItemId: {
    currentKey: 'praxon.return.itemId',
    legacyKeys: ['hotpulse_return_item_id'],
  },
} as const satisfies Record<string, StorageKeyMigration>;

export function withStorageKeySuffix(
  migration: StorageKeyMigration,
  suffix: string,
): StorageKeyMigration {
  return {
    currentKey: `${migration.currentKey}:${suffix}`,
    legacyKeys: migration.legacyKeys.map((key) => `${key}:${suffix}`),
  };
}

export function readMigratedStorageItem(
  storage: Storage,
  migration: StorageKeyMigration,
  isValid: (value: string) => boolean = () => true,
): string | null {
  try {
    const currentValue = storage.getItem(migration.currentKey);
    if (currentValue !== null) {
      return isValid(currentValue) ? currentValue : null;
    }

    for (const legacyKey of migration.legacyKeys) {
      const legacyValue = storage.getItem(legacyKey);
      if (legacyValue === null || !isValid(legacyValue)) continue;
      try {
        storage.setItem(migration.currentKey, legacyValue);
      } catch {
        // The legacy value is still usable when the browser cannot persist the copy.
      }
      return legacyValue;
    }
  } catch {
    return null;
  }
  return null;
}

export function readMigratedJsonItem<T>(
  storage: Storage,
  migration: StorageKeyMigration,
  isValid: (value: unknown) => value is T,
): T | null {
  const raw = readMigratedStorageItem(storage, migration, (value) => {
    try {
      return isValid(JSON.parse(value));
    } catch {
      return false;
    }
  });
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCurrentStorageItem(
  storage: Storage,
  migration: StorageKeyMigration,
  value: string,
): boolean {
  try {
    storage.setItem(migration.currentKey, value);
    return true;
  } catch {
    return false;
  }
}

export function clearMigratedStorageItems(
  storage: Storage,
  migration: StorageKeyMigration,
): void {
  for (const key of [migration.currentKey, ...migration.legacyKeys]) {
    try {
      storage.removeItem(key);
    } catch {
      // Best-effort cleanup for an explicit user reset.
    }
  }
}
