import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./codeHighlighter", () => ({
  highlightSource: vi.fn(async () => [
    {
      content: "<script>alert(1)</script>",
      lineNumber: 1,
      tokens: [{ content: "<script>alert(1)</script>", offset: 0, color: "#ff0000", fontStyle: null }]
    }
  ])
}));

import { highlightSource } from "./codeHighlighter";
import { CodeSourceView } from "./CodeSourceView";

describe("CodeSourceView", () => {
  it("renders highlighted repository text as escaped React text", async () => {
    const { container } = render(
      <CodeSourceView content="<script>alert(1)</script>" highlightedLine={1} path="src/main.ts" />
    );

    expect(screen.getByLabelText("Source for src/main.ts")).toBeInTheDocument();
    expect(screen.getByText("Highlighted line 1")).toHaveClass("sr-only");

    await waitFor(() => expect(screen.queryByText("Loading syntax highlighting…")).not.toBeInTheDocument());

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(container.querySelector(".code-source-line.highlighted")).not.toBeNull();
    expect(container.querySelector(".code-source-line-number")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses plain text for unsupported languages without calling the highlighter", () => {
    render(<CodeSourceView content="plain text" highlightedLine={null} path="LICENSE" />);

    expect(screen.getByText("Syntax highlighting unavailable for this file type.")).toBeInTheDocument();
    expect(screen.getByText("plain text")).toBeInTheDocument();
  });

  it("preserves source whitespace in rendered line text", () => {
    const content = "alpha\n\nomega\n";
    const { container } = render(<CodeSourceView content={content} highlightedLine={null} path="LICENSE" />);
    const sourceText = Array.from(container.querySelectorAll(".code-source-line-text"))
      .map((line) => line.textContent)
      .join("");

    expect(sourceText).toBe(content);
  });

  it("preserves whitespace-only highlighted lines when the highlighter returns no tokens", async () => {
    vi.mocked(highlightSource).mockResolvedValueOnce([{ content: "  ", lineNumber: 1, tokens: [] }]);

    const { container } = render(<CodeSourceView content="  " highlightedLine={null} path="src/main.ts" />);

    await waitFor(() => expect(screen.queryByText("Loading syntax highlighting…")).not.toBeInTheDocument());

    expect(container.querySelector(".code-source-line-text")?.textContent).toBe("  ");
  });
});
