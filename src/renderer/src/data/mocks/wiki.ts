import type { RepositoryWikiResult } from "@shared/github";

export function mockRepositoryWiki(pagePath?: string | null, limit?: number): RepositoryWikiResult {
  const allPages = [
    {
      path: "Home.md",
      title: "Home",
      sha: "wiki-home",
      size: 980,
      htmlUrl: "https://github.com/apple/swift/wiki/Home"
    },
    {
      path: "Contributor-Guide.md",
      title: "Contributor Guide",
      sha: "wiki-contributor-guide",
      size: 1420,
      htmlUrl: "https://github.com/apple/swift/wiki/Contributor-Guide"
    },
    {
      path: "Release-Checklist.md",
      title: "Release Checklist",
      sha: "wiki-release-checklist",
      size: 1180,
      htmlUrl: "https://github.com/apple/swift/wiki/Release-Checklist"
    }
  ];
  const pages = allPages.slice(0, limit ?? allPages.length);
  const selectedPage = allPages.find((page) => page.path === pagePath) ?? pages[0] ?? allPages[0];

  return {
    pages,
    selectedPage: {
      ...selectedPage,
      markdown: `# ${selectedPage.title}\n\nMock wiki content for ${selectedPage.title}.\n\n- Review repository settings\n- Confirm Actions status\n- Update release notes`
    },
    availability: { status: "available", message: null }
  };
}
