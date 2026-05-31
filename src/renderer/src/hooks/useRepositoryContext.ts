import { use } from "react";

import { RepositoryContext } from "../components/repository/RepositoryContext";

export function useRepositoryContext() {
  const context = use(RepositoryContext);
  if (!context) {
    throw new Error("useRepositoryContext must be used within RepositoryContextProvider.");
  }
  return context;
}
