import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { defaultControlExportScope } from "@shared/sync";
import { createControlExportPreview, controlExportRedactionSummary } from "./exportPreview";
import {
  applyControlImport,
  createControlExportArchive,
  createControlImportPreview,
  writeControlExportArchive
} from "./exportArchive";
import { MemoryLocalStore } from "./memoryStore";

describe("Control export preview", () => {
  it("classifies field-level redaction boundaries before any file export exists", () => {
    expect(controlExportRedactionSummary.map((rule) => rule.field)).toEqual(
      expect.arrayContaining([
        "github.oauthToken",
        "gateway.apiToken",
        "gateway.adminToken",
        "areas.root_path",
        "area_gateways.rootPath",
        "area_repositories.path",
        "area_workspaces.root_path",
        "area_repositories.connection_json.remoteUrl",
        "recent_items.payload.metadata.path",
        "recent_items.payload.metadata.url",
        "recent_items.payload.metadata.ref",
        "github_repositories.readme_markdown",
        "github_repositories.summary_json",
        "github_repositories.detail_json",
        "github_repositories.viewer_state_json",
        "github_repositories.permissions_json",
        "area_repo_snapshots.payload",
        "area_workspace_snapshots.payload"
      ])
    );
    expect(controlExportRedactionSummary.filter((rule) => rule.dataClass === "secret")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "github.oauthToken", action: "blocked" }),
        expect.objectContaining({ field: "gateway.apiToken", action: "blocked" }),
        expect.objectContaining({ field: "gateway.adminToken", action: "blocked" })
      ])
    );
  });

  it("reports private scopes and gateway migration blockers without writing data", () => {
    const store = new MemoryLocalStore();
    const area = store.createLocalArea({ rootPath: "/work/control", label: "Control" });
    store.setAreaGateway({
      areaId: area.id,
      rootPath: "/work/control",
      transport: "local",
      host: null,
      username: null,
      port: null,
      apiUrl: null,
      adminUrl: null,
      serviceName: null,
      version: null,
      status: "error",
      pid: null,
      processId: null,
      failureCode: "gateway-credentials-migration-pending",
      message: "Gateway credentials could not be migrated.",
      installedAt: null,
      lastStartedAt: null,
      lastSeenAt: null,
      updatedAt: "2026-05-24T00:00:00.000Z"
    });

    const preview = createControlExportPreview(store, {
      ...defaultControlExportScope,
      areas: true,
      pins: true
    });

    expect(preview.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "areas",
          included: true,
          dataClass: "private",
          sensitiveCategories: expect.arrayContaining(["local-path", "gateway-metadata"])
        }),
        expect.objectContaining({ id: "github-cache", included: false, dataClass: "cache" })
      ])
    );
    expect(preview.blockers).toEqual(["Gateway credentials are pending keychain migration for Control."]);
  });

  it("writes versioned JSON archives atomically with redacted local paths", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-import-preview-"));
    try {
      const filePath = join(tempDir, "control-export.json");
      const store = new MemoryLocalStore();
      store.updateSettings({ glassMode: "solid" });
      store.createLocalArea({ rootPath: "/private/work/control", label: "Control" });
      store.pinRepository("owner/repo");

      const result = await writeControlExportArchive(store, {
        scope: {
          ...defaultControlExportScope,
          areas: true,
          pins: true,
          snapshots: true,
          includeLocalPaths: false
        },
        destinationPath: filePath
      });
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ReturnType<
        typeof createControlExportArchive
      >;

      expect(result.filePath).toBe(filePath);
      expect(result.bytesWritten).toBeGreaterThan(0);
      expect(existsSync(filePath)).toBe(true);
      expect(parsed.manifest.schemaVersion).toBe(1);
      expect(parsed.data.settings?.glassMode).toBe("solid");
      expect(parsed.data.areas?.[0]).toMatchObject({
        label: "Control",
        rootPath: null,
        subtitle: null
      });
      expect(parsed.data.pins?.repositories).toEqual(["owner/repo"]);
      expect(parsed.data.snapshots).toEqual({ areaRepoSnapshots: [], areaWorkspaceSnapshots: [] });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("previews and applies durable import sections without importing cache data or secrets", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-import-preview-"));
    try {
      const filePath = join(tempDir, "control-export.json");
      const source = new MemoryLocalStore();
      source.updateSettings({ glassMode: "solid" });
      source.createLocalArea({ rootPath: "/private/work/control", label: "Control" });
      source.pinRepository("owner/repo");
      source.addRecentItem("repository", "github", "owner/repo", {
        kind: "repository",
        provider: "github",
        itemKey: "owner/repo",
        title: "owner/repo",
        subtitle: null,
        repositoryNameWithOwner: "owner/repo",
        url: "https://github.com/owner/repo",
        metadata: { path: "/private/work/control", ref: "main" }
      });
      await writeControlExportArchive(source, {
        scope: {
          ...defaultControlExportScope,
          areas: true,
          pins: true,
          recents: true,
          includeLocalPaths: false
        },
        destinationPath: filePath
      });

      await expect(createControlImportPreview({ filePath })).resolves.toMatchObject({
        filePath,
        schemaVersion: 1,
        items: [
          expect.objectContaining({ id: "settings", action: "update" }),
          expect.objectContaining({ id: "areas", action: "remap" }),
          expect.objectContaining({ id: "pins", action: "insert" }),
          expect.objectContaining({ id: "recents", action: "insert" })
        ],
        blockers: []
      });

      const target = new MemoryLocalStore();
      const result = await applyControlImport(target, { filePath, confirmed: true });

      expect(result).toMatchObject({
        applied: true,
        importedItems: 4,
        insertedItems: 2,
        updatedItems: 2,
        skippedItems: 1,
        remappedItems: 1,
        blockedItems: 0,
        emittedEvents: ["recents-updated", "repository-pins-updated", "settings-updated"]
      });
      expect(target.getSettings().glassMode).toBe("solid");
      expect(target.listPinnedRepositories()).toEqual(["owner/repo"]);
      expect(target.listRecentItems({ limit: 5 })).toHaveLength(1);
      expect(target.listAreas().some((area) => area.label === "Control")).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects unsupported import schema versions before applying data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-import-preview-"));
    try {
      const filePath = join(tempDir, "control-export.json");
      writeFileSync(filePath, JSON.stringify({ manifest: { schemaVersion: 2 }, data: {} }));

      await expect(createControlImportPreview({ filePath })).resolves.toMatchObject({
        filePath,
        schemaVersion: null,
        items: [],
        blockers: ["Control import requires export schema version 1."]
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects malformed import sections before applying data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-import-preview-"));
    try {
      const filePath = join(tempDir, "control-export.json");
      writeFileSync(
        filePath,
        JSON.stringify({
          manifest: { schemaVersion: 1 },
          data: { pins: { repositories: ["owner/repo", "not-a-repository-name"] } }
        })
      );

      await expect(createControlImportPreview({ filePath })).resolves.toMatchObject({
        filePath,
        schemaVersion: null,
        items: [],
        blockers: ["Control import repository pins section is malformed."]
      });
      await expect(
        applyControlImport(new MemoryLocalStore(), { filePath, confirmed: true })
      ).resolves.toMatchObject({
        applied: false,
        importedItems: 0,
        insertedItems: 0,
        updatedItems: 0,
        skippedItems: 0,
        remappedItems: 0,
        blockedItems: 1
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
