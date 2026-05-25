import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { defaultControlExportScope } from "@shared/sync";
import {
  createControlExportPreview,
  createControlImportPreview,
  controlExportRedactionSummary
} from "./exportPreview";
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

  it("previews import manifests without applying data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-import-preview-"));
    try {
      const filePath = join(tempDir, "control-export.json");
      writeFileSync(filePath, JSON.stringify({ manifest: { schemaVersion: 1 } }));

      await expect(createControlImportPreview({ filePath })).resolves.toEqual({
        schemaVersion: 1,
        items: [
          {
            id: "control-export-manifest",
            label: "Control export manifest",
            action: "skip",
            dataClass: "durable",
            estimatedCount: 1,
            message: "Import apply is not implemented in pass 1."
          }
        ],
        blockers: ["Import apply is not implemented in pass 1."]
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
