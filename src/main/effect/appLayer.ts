import { Layer, ManagedRuntime } from "effect";

import type { GitHubProviderManager } from "../github/provider";
import type { LocalStore } from "../storage";
import {
  BackendLoggerServiceTag,
  ExternalLinkServiceTag,
  GitHubManagerService,
  LocalStoreService,
  type AppServices,
  type BackendLoggerService,
  type ExternalLinkService
} from "./services";

export interface AppLayerDependencies {
  readonly store: LocalStore;
  readonly github: GitHubProviderManager;
  readonly externalLinks: ExternalLinkService;
  readonly logger?: BackendLoggerService;
}

const defaultBackendLogger: BackendLoggerService = {
  error: (message, cause) => console.error(message, cause)
};

function createAppLayer(dependencies: AppLayerDependencies): Layer.Layer<AppServices> {
  return Layer.mergeAll(
    Layer.succeed(LocalStoreService, dependencies.store),
    Layer.succeed(GitHubManagerService, dependencies.github),
    Layer.succeed(ExternalLinkServiceTag, dependencies.externalLinks),
    Layer.succeed(BackendLoggerServiceTag, dependencies.logger ?? defaultBackendLogger)
  );
}

export function createAppRuntime(
  dependencies: AppLayerDependencies,
  makeRuntime: typeof ManagedRuntime.make = ManagedRuntime.make
): ManagedRuntime.ManagedRuntime<AppServices, never> {
  return makeRuntime(createAppLayer(dependencies));
}
