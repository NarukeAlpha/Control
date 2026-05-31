import type { GitHubProviderManager } from "../github/provider";
import type { LocalStore } from "../storage";
import { Context } from "effect";

export interface ExternalLinkService {
  openExternal(url: string): Promise<void>;
}

export interface BackendLoggerService {
  error(message: string, cause: unknown): void;
}

export class LocalStoreService extends Context.Tag("control/LocalStoreService")<
  LocalStoreService,
  LocalStore
>() {}

export class GitHubManagerService extends Context.Tag("control/GitHubManagerService")<
  GitHubManagerService,
  GitHubProviderManager
>() {}

export class ExternalLinkServiceTag extends Context.Tag("control/ExternalLinkService")<
  ExternalLinkServiceTag,
  ExternalLinkService
>() {}

export class BackendLoggerServiceTag extends Context.Tag("control/BackendLoggerService")<
  BackendLoggerServiceTag,
  BackendLoggerService
>() {}

export type AppServices =
  | LocalStoreService
  | GitHubManagerService
  | ExternalLinkServiceTag
  | BackendLoggerServiceTag;
