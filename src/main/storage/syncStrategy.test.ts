import { describe, expect, it } from "vitest";

import {
  controlAppDataSyncPolicy,
  mergeControlAppDataRecords,
  type ControlAppDataSyncRecord
} from "./syncStrategy";

describe("mergeControlAppDataRecords", () => {
  it("keeps the hosted app-data sync policy explicit and secret-free", () => {
    expect(controlAppDataSyncPolicy.allowedCollections).toEqual([
      "settings",
      "repository-pins",
      "area-pins",
      "recents"
    ]);
    expect(controlAppDataSyncPolicy.forbiddenDataClasses).toEqual(
      expect.arrayContaining(["secrets", "provider-cache", "area-cache", "snapshots", "gateway-credentials"])
    );
  });

  it("uses deterministic last-writer-wins for durable app-data records", () => {
    const local: ControlAppDataSyncRecord<{ pinned: boolean }>[] = [
      {
        collection: "repository-pins",
        id: "owner/repo",
        value: { pinned: true },
        updatedAt: "2026-05-25T10:00:00.000Z",
        sourceDeviceId: "device-a"
      }
    ];
    const remote: ControlAppDataSyncRecord<{ pinned: boolean }>[] = [
      {
        collection: "repository-pins",
        id: "owner/repo",
        value: { pinned: false },
        updatedAt: "2026-05-25T11:00:00.000Z",
        sourceDeviceId: "device-b"
      }
    ];

    expect(mergeControlAppDataRecords(local, remote)).toEqual({
      records: [remote[0]],
      changedRecordIds: ["owner/repo"],
      tombstoneRecordIds: []
    });
  });

  it("keeps delete tombstones when they are the latest durable record", () => {
    const local: ControlAppDataSyncRecord<{ title: string }>[] = [
      {
        collection: "recents",
        id: "issue:1",
        value: { title: "Issue 1" },
        updatedAt: "2026-05-25T10:00:00.000Z",
        sourceDeviceId: "device-a"
      }
    ];
    const remote: ControlAppDataSyncRecord<{ title: string }>[] = [
      {
        collection: "recents",
        id: "issue:1",
        value: null,
        updatedAt: "2026-05-25T10:30:00.000Z",
        deletedAt: "2026-05-25T10:30:00.000Z",
        sourceDeviceId: "device-b"
      }
    ];

    expect(mergeControlAppDataRecords(local, remote)).toEqual({
      records: [remote[0]],
      changedRecordIds: ["issue:1"],
      tombstoneRecordIds: ["issue:1"]
    });
  });

  it("breaks equal timestamps by source device id and value for repeatable merges", () => {
    const left: ControlAppDataSyncRecord<{ glassMode: string }>[] = [
      {
        collection: "settings",
        id: "global",
        value: { glassMode: "solid" },
        updatedAt: "2026-05-25T10:00:00.000Z",
        sourceDeviceId: "device-a"
      }
    ];
    const right: ControlAppDataSyncRecord<{ glassMode: string }>[] = [
      {
        collection: "settings",
        id: "global",
        value: { glassMode: "reduced" },
        updatedAt: "2026-05-25T10:00:00.000Z",
        sourceDeviceId: "device-b"
      }
    ];

    expect(mergeControlAppDataRecords(left, right).records).toEqual([right[0]]);
    expect(mergeControlAppDataRecords(right, left).records).toEqual([right[0]]);
  });
});
