import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ControlApi } from "@shared/ipc";
import {
  RepositoryContextProvider,
  type RepositoryContextValue
} from "../components/repository/RepositoryContext";
import { useRepositoryContext } from "./useRepositoryContext";

function Probe(): JSX.Element {
  const context = useRepositoryContext();
  return <div>{`${context.nameWithOwner}:${context.githubReady ? "ready" : "offline"}`}</div>;
}

function createValue(): RepositoryContextValue {
  return {
    owner: "NarukeAlpha",
    repo: "control",
    nameWithOwner: "NarukeAlpha/control",
    githubReady: true,
    api: {} as ControlApi,
    queryClient: new QueryClient()
  };
}

describe("useRepositoryContext", () => {
  it("returns provider values", () => {
    render(
      <RepositoryContextProvider value={createValue()}>
        <Probe />
      </RepositoryContextProvider>
    );

    expect(screen.getByText("NarukeAlpha/control:ready")).toBeInTheDocument();
  });

  it("throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow(
      "useRepositoryContext must be used within RepositoryContextProvider."
    );

    spy.mockRestore();
  });
});
