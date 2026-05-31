import { create } from "zustand";

export interface ContributorsTabLocalState {
  filter: string;
  selectedContributorLogin: string | null;
  profileRepositoryLimits: Record<string, number>;
}

interface ContributorsTabStateStore {
  records: Record<string, ContributorsTabLocalState>;
  updateState(key: string, patch: Partial<ContributorsTabLocalState>): void;
  clear(): void;
}

const maxRetainedContributorsTabStates = 25;
const defaultContributorsTabState: ContributorsTabLocalState = {
  filter: "",
  selectedContributorLogin: null,
  profileRepositoryLimits: {}
};

function retainContributorsTabState(
  records: Record<string, ContributorsTabLocalState>,
  key: string,
  patch: Partial<ContributorsTabLocalState>
): Record<string, ContributorsTabLocalState> {
  const current = records[key] ?? defaultContributorsTabState;
  const { [key]: _existing, ...rest } = records;
  const nextRecords = {
    ...rest,
    [key]: {
      ...current,
      ...patch
    }
  };
  const keys = Object.keys(nextRecords);

  if (keys.length <= maxRetainedContributorsTabStates) {
    return nextRecords;
  }

  return Object.fromEntries(
    keys
      .slice(keys.length - maxRetainedContributorsTabStates)
      .map((retainedKey) => [retainedKey, nextRecords[retainedKey]])
  );
}

export const useContributorsTabStateStore = create<ContributorsTabStateStore>((set) => ({
  records: {},
  updateState: (key, patch) =>
    set((state) => ({
      records: retainContributorsTabState(state.records, key, patch)
    })),
  clear: () => set({ records: {} })
}));

export function useContributorsTabLocalState(key: string): ContributorsTabLocalState {
  return useContributorsTabStateStore((state) => state.records[key] ?? defaultContributorsTabState);
}

export function clearContributorsTabStateForTests(): void {
  useContributorsTabStateStore.getState().clear();
}
