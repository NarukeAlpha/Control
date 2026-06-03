import type { AreaGatewayOperationInput, AreaGatewayOperationKind } from "@shared/areas";

interface SupportedGatewayOperation {
  vcs: "GIT" | "JJ";
  operation: "FETCH" | "PUSH";
}

interface UnsupportedGatewayOperation {
  unsupported: true;
}

type GatewayOperationMapping = SupportedGatewayOperation | UnsupportedGatewayOperation;

const unsupportedGatewayOperation = { unsupported: true } satisfies UnsupportedGatewayOperation;

const gatewayOperationMappings = {
  "git.fetch": { vcs: "GIT", operation: "FETCH" },
  "git.pull": unsupportedGatewayOperation,
  "git.push": { vcs: "GIT", operation: "PUSH" },
  "git.commit": unsupportedGatewayOperation,
  "git.branch.create": unsupportedGatewayOperation,
  "git.branch.checkout": unsupportedGatewayOperation,
  "jj.git.fetch": { vcs: "JJ", operation: "FETCH" },
  "jj.git.push": { vcs: "JJ", operation: "PUSH" },
  "jj.new": unsupportedGatewayOperation,
  "jj.describe": unsupportedGatewayOperation,
  "jj.commit": unsupportedGatewayOperation,
  "jj.bookmark.create": unsupportedGatewayOperation,
  "jj.bookmark.move": unsupportedGatewayOperation,
  "jj.undo": unsupportedGatewayOperation,
  "jj.redo": unsupportedGatewayOperation
} satisfies Record<AreaGatewayOperationKind, GatewayOperationMapping>;

export const areaGatewayOperationKinds = Object.keys(gatewayOperationMappings) as AreaGatewayOperationKind[];

export function isAreaGatewayOperationKind(value: unknown): value is AreaGatewayOperationKind {
  return typeof value === "string" && value in gatewayOperationMappings;
}

export function gatewayOperationInput(input: AreaGatewayOperationInput): Record<string, unknown> {
  const mapping = gatewayOperationMappings[input.kind];
  if ("unsupported" in mapping) {
    throw new Error(`Gateway operation is not supported yet: ${input.kind}.`);
  }
  if (input.arguments && Object.keys(input.arguments).length > 0) {
    throw new Error(`Gateway operation arguments are not supported for ${input.kind}.`);
  }
  return {
    repository: input.repositoryId,
    vcs: mapping.vcs,
    operation: mapping.operation
  };
}
