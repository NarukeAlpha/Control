import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import type { BrowserWindow as BrowserWindowType } from "electron";
import liquidGlass from "electron-liquid-glass";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type {
  ActionsInput,
  DiscussionListInput,
  GitHubMutationInput,
  IssueListInput,
  ProjectsInput,
  PullRequestListInput,
  ReleasesInput,
  RepoContentsInput,
  RepoDetailInput,
  SearchInput
} from "@shared/github";
import { ipcChannels } from "@shared/ipc";
import { createAppState, GitHubProviderManager } from "./github/provider";
import { createLocalStore, type LocalStore } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindowType | null = null;
let liquidGlassViewId = -1;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1512,
    height: 982,
    minWidth: 1120,
    minHeight: 760,
    show: false,
    title: "Control",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 24, y: 22 },
    backgroundMaterial: process.platform === "win32" ? "mica" : undefined,
    transparent: process.platform === "darwin",
    backgroundColor: "#dceafb00",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.platform === "darwin") {
    mainWindow.setWindowButtonVisibility(true);
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.once("did-finish-load", () => {
    applyLiquidGlass(mainWindow);
  });
}

function applyLiquidGlass(window: BrowserWindowType | null): void {
  if (!window || process.platform !== "darwin") {
    return;
  }

  try {
    liquidGlassViewId = liquidGlass.addView(window.getNativeWindowHandle(), {
      cornerRadius: 30,
      tintColor: "#DDEEFF30",
      opaque: false
    });

    if (liquidGlassViewId >= 0) {
      liquidGlass.unstable_setVariant(liquidGlassViewId, liquidGlass.GlassMaterialVariant.control);
      liquidGlass.unstable_setScrim(liquidGlassViewId, 0);
      liquidGlass.unstable_setSubdued(liquidGlassViewId, 0);
    }
  } catch (error) {
    console.warn("Control could not apply native liquid glass.", error);
  }
}

function registerIpc(store: LocalStore, github: GitHubProviderManager): void {
  ipcMain.handle(ipcChannels.appState, async () => createAppState(store));
  ipcMain.handle(ipcChannels.getSettings, () => store.getSettings());
  ipcMain.handle(ipcChannels.updateSettings, (_event, settings) => store.updateSettings(settings));
  ipcMain.handle(ipcChannels.openExternal, async (_event, url: string) => {
    if (!url.startsWith("https://")) {
      throw new Error("Control only opens external HTTPS links.");
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(ipcChannels.githubViewer, () => github.getViewer());
  ipcMain.handle(ipcChannels.githubRepositories, (_event, input = {}) => github.listRepositories(input));
  ipcMain.handle(ipcChannels.githubRepository, (_event, input: RepoDetailInput) =>
    github.getRepository(input.owner, input.repo)
  );
  ipcMain.handle(ipcChannels.githubContents, (_event, input: RepoContentsInput) => github.listContents(input));
  ipcMain.handle(ipcChannels.githubIssues, (_event, input: IssueListInput) => github.listIssues(input));
  ipcMain.handle(ipcChannels.githubPullRequests, (_event, input: PullRequestListInput) =>
    github.listPullRequests(input)
  );
  ipcMain.handle(ipcChannels.githubDiscussions, (_event, input: DiscussionListInput) =>
    github.listDiscussions(input)
  );
  ipcMain.handle(ipcChannels.githubActions, (_event, input: ActionsInput) => github.listActions(input));
  ipcMain.handle(ipcChannels.githubProjects, (_event, input: ProjectsInput) => github.listProjects(input));
  ipcMain.handle(ipcChannels.githubReleases, (_event, input: ReleasesInput) => github.listReleases(input));
  ipcMain.handle(ipcChannels.githubContributors, (_event, input: RepoDetailInput) =>
    github.listContributors(input)
  );
  ipcMain.handle(ipcChannels.githubSearch, (_event, input: SearchInput) => github.search(input));
  ipcMain.handle(ipcChannels.githubMutate, (_event, input: GitHubMutationInput) => github.mutate(input));
}

app.commandLine.appendSwitch("enable-features", "Vibrancy,PlatformHEVCDecoderSupport");
nativeTheme.themeSource = "light";

void bootstrap();

async function bootstrap(): Promise<void> {
  await app.whenReady();

  const store = await createLocalStore(app.getPath("userData"));
  const initialState = await createAppState(store);
  if (initialState.gh.path && !initialState.settings.ghPath) {
    store.updateSettings({ ghPath: initialState.gh.path });
  }
  const github = new GitHubProviderManager(store);

  registerIpc(store, github);
  createWindow();
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
