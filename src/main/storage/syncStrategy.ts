export type ControlAppDataSyncCollection = "settings" | "repository-pins" | "area-pins" | "recents";

export const controlAppDataSyncPolicy = {
  allowedCollections: ["settings", "repository-pins", "area-pins", "recents"],
  forbiddenDataClasses: ["secrets", "provider-cache", "area-cache", "snapshots", "gateway-credentials"],
  secretBehavior:
    "Secrets are excluded from hosted app-data sync and must use provider-specific credential flows."
} as const;

export interface ControlAppDataSyncRecord<TValue> {
  collection: ControlAppDataSyncCollection;
  id: string;
  value: TValue | null;
  updatedAt: string;
  deletedAt?: string | null;
  sourceDeviceId: string;
}

export interface ControlAppDataMergeResult<TValue> {
  records: ControlAppDataSyncRecord<TValue>[];
  changedRecordIds: string[];
  tombstoneRecordIds: string[];
}

export function mergeControlAppDataRecords<TValue>(
  localRecords: ControlAppDataSyncRecord<TValue>[],
  remoteRecords: ControlAppDataSyncRecord<TValue>[]
): ControlAppDataMergeResult<TValue> {
  const merged = new Map<string, ControlAppDataSyncRecord<TValue>>();
  for (const record of [...localRecords, ...remoteRecords]) {
    const current = merged.get(recordKey(record));
    if (!current || compareSyncRecords(record, current) > 0) {
      merged.set(recordKey(record), record);
    }
  }

  const records = [...merged.values()].sort((left, right) => recordKey(left).localeCompare(recordKey(right)));
  const localKeys = new Set(localRecords.map(recordKey));
  return {
    records,
    changedRecordIds: records
      .filter(
        (record) =>
          !localKeys.has(recordKey(record)) ||
          compareSyncRecords(record, localRecord(record, localRecords)) !== 0
      )
      .map((record) => record.id),
    tombstoneRecordIds: records.filter((record) => Boolean(record.deletedAt)).map((record) => record.id)
  };
}

function localRecord<TValue>(
  record: ControlAppDataSyncRecord<TValue>,
  localRecords: ControlAppDataSyncRecord<TValue>[]
): ControlAppDataSyncRecord<TValue> {
  return localRecords.find((candidate) => recordKey(candidate) === recordKey(record)) ?? record;
}

function compareSyncRecords<TValue>(
  left: ControlAppDataSyncRecord<TValue>,
  right: ControlAppDataSyncRecord<TValue>
): number {
  const leftTimestamp = effectiveTimestamp(left);
  const rightTimestamp = effectiveTimestamp(right);
  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }
  const sourceComparison = left.sourceDeviceId.localeCompare(right.sourceDeviceId);
  if (sourceComparison !== 0) {
    return sourceComparison;
  }
  return JSON.stringify(left.value).localeCompare(JSON.stringify(right.value));
}

function effectiveTimestamp(record: ControlAppDataSyncRecord<unknown>): number {
  const updatedAt = Date.parse(record.updatedAt);
  const deletedAt = record.deletedAt ? Date.parse(record.deletedAt) : Number.NaN;
  return Math.max(Number.isFinite(updatedAt) ? updatedAt : 0, Number.isFinite(deletedAt) ? deletedAt : 0);
}

function recordKey(record: ControlAppDataSyncRecord<unknown>): string {
  return `${record.collection}:${record.id}`;
}
