import type {
  GitHubReadAvailability,
  ReleaseListResult,
  ReleaseSummary,
  ReleasesInput
} from "@shared/github";

export interface OctokitReleaseClient {
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
}

export class OctokitReleaseDomain {
  constructor(
    private readonly client: OctokitReleaseClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listReleases(input: ReleasesInput): Promise<ReleaseSummary[]> {
    const data = await this.client.restPaginatedArray<GitHubRelease>(
      "GET /repos/{owner}/{repo}/releases",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 20
    );
    return data.map(mapRelease);
  }

  async listReleasesWithStatus(input: ReleasesInput): Promise<ReleaseListResult> {
    try {
      return {
        items: await this.listReleases(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }
}

function mapRelease(release: GitHubRelease): ReleaseSummary {
  return {
    id: release.id,
    name: release.name,
    tagName: release.tag_name,
    targetCommitish: release.target_commitish ?? null,
    body: release.body ?? null,
    isDraft: release.draft,
    isPrerelease: release.prerelease,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    assets: (release.assets ?? []).map(mapReleaseAsset)
  };
}

function mapReleaseAsset(asset: GitHubReleaseAsset): ReleaseSummary["assets"][number] {
  return {
    id: asset.id,
    name: asset.name,
    label: asset.label ?? null,
    state: asset.state ?? null,
    contentType: asset.content_type ?? null,
    sizeInBytes: asset.size,
    downloadCount: asset.download_count ?? 0,
    browserDownloadUrl: asset.browser_download_url ?? null,
    createdAt: asset.created_at ?? null,
    updatedAt: asset.updated_at ?? null
  };
}

export interface GitHubRelease {
  id: number;
  name: string | null;
  tag_name: string;
  target_commitish?: string | null;
  body?: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  assets?: GitHubReleaseAsset[];
}

interface GitHubReleaseAsset {
  id: number;
  name: string;
  label?: string | null;
  state?: string | null;
  content_type?: string | null;
  size: number;
  download_count?: number | null;
  browser_download_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
