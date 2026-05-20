import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownBody, MarkdownUrlHandlerContext, type MarkdownUrlContext } from "./MarkdownBody";

function renderMarkdown(markdown: string, context?: MarkdownUrlContext, onOpenExternal = vi.fn()) {
  render(<MarkdownBody markdown={markdown} onOpenExternal={onOpenExternal} urlContext={context} />);
  return onOpenExternal;
}

describe("MarkdownBody", () => {
  it("routes safe HTTPS links through the callback", () => {
    const onOpenExternal = renderMarkdown("[Control](https://github.com/control/control)");

    fireEvent.click(screen.getByRole("button", { name: "Control" }));

    expect(onOpenExternal).toHaveBeenCalledWith("https://github.com/control/control");
  });

  it("renders unsafe links and images safely", () => {
    renderMarkdown("[Unsafe](javascript:alert(1)) ![Unsafe image](http://example.com/image.png)");

    expect(screen.queryByRole("button", { name: "Unsafe" })).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe")).toHaveClass("markdown-unsafe");
    expect(screen.getByText("Unsafe image")).toHaveClass("markdown-unsafe");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders headings, lists, and fenced code blocks", () => {
    renderMarkdown("# Title\n\n- item\n\n```ts\nconst value = 1;\n```");

    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("item");
    expect(screen.getByText("const value = 1;")).toBeInTheDocument();
  });

  it("resolves root-relative and ordinary relative links from context", () => {
    const onOpenExternal = vi.fn();
    const context: MarkdownUrlContext = {
      linkBaseUrl: "https://github.com/apple/swift/blob/main/docs/",
      linkRootUrl: "https://github.com/apple/swift/blob/main/",
      imageBaseUrl: "https://raw.githubusercontent.com/apple/swift/main/docs/",
      imageRootUrl: "https://raw.githubusercontent.com/apple/swift/main/",
      repositoryHtmlUrl: "https://github.com/apple/swift"
    };

    render(
      <MarkdownBody
        markdown="[Root](/README.md) [Relative](guide.md)"
        onOpenExternal={onOpenExternal}
        urlContext={context}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Root" }));
    fireEvent.click(screen.getByRole("button", { name: "Relative" }));

    expect(onOpenExternal).toHaveBeenNthCalledWith(1, "https://github.com/apple/swift/blob/main/README.md");
    expect(onOpenExternal).toHaveBeenNthCalledWith(
      2,
      "https://github.com/apple/swift/blob/main/docs/guide.md"
    );
  });

  it("does not click protocol-relative or unsafe protocol links", () => {
    renderMarkdown("[Protocol]//evil.test [Relative](//evil.test) [HTTP](http://example.com)");

    expect(screen.queryByRole("button", { name: "Protocol" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Relative" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HTTP" })).not.toBeInTheDocument();
  });

  it("excludes trailing punctuation from autolinks", () => {
    const onOpenExternal = renderMarkdown("See https://github.com/apple/swift.");

    const link = screen.getByRole("button", { name: "https://github.com/apple/swift" });
    fireEvent.click(link);

    expect(onOpenExternal).toHaveBeenCalledWith("https://github.com/apple/swift");
    expect(link.closest("p")).toHaveTextContent("See https://github.com/apple/swift.");
  });

  it("routes repository-context user and issue references", () => {
    const onOpenMarkdownUrl = vi.fn();
    const context: MarkdownUrlContext = {
      linkBaseUrl: "https://github.com/apple/swift/blob/main/",
      linkRootUrl: "https://github.com/apple/swift/blob/main/",
      imageBaseUrl: "https://raw.githubusercontent.com/apple/swift/main/",
      imageRootUrl: "https://raw.githubusercontent.com/apple/swift/main/",
      repositoryHtmlUrl: "https://github.com/apple/swift"
    };

    render(
      <MarkdownUrlHandlerContext.Provider value={onOpenMarkdownUrl}>
        <MarkdownBody markdown="@swiftlang fixed #123" onOpenExternal={vi.fn()} urlContext={context} />
      </MarkdownUrlHandlerContext.Provider>
    );

    fireEvent.click(screen.getByRole("button", { name: "@swiftlang" }));
    fireEvent.click(screen.getByRole("button", { name: "#123" }));

    expect(onOpenMarkdownUrl).toHaveBeenNthCalledWith(1, "https://github.com/swiftlang");
    expect(onOpenMarkdownUrl).toHaveBeenNthCalledWith(2, "https://github.com/apple/swift/issues/123");
  });
});
