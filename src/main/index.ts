import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import type { BrowserWindow as BrowserWindowType } from "electron";
import liquidGlass from "electron-liquid-glass";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { GitHubProviderManager } from "./github/provider";
import { createLocalStore } from "./storage";
import { AreaManager } from "./areas/areaManager";
import { GatewayManager } from "./areas/gatewayManager";
import { registerAreaIpc } from "./areas/registerAreaIpc";
import { createAppRuntime } from "./effect/appLayer";
import { createEffectIpcBridge } from "./effect/ipcBridge";
import { openExternalHttps } from "./externalLinks";
import { sendMainToRendererEvent } from "./ipc/events";
import { registerControlIpc } from "./ipc/registerControlIpc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindowType | null = null;
let liquidGlassViewId = -1;

if (process.env.CONTROL_USER_DATA_DIR) {
  app.setPath("userData", process.env.CONTROL_USER_DATA_DIR);
}

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
    backgroundColor: process.platform === "darwin" ? "#00000000" : "#eef6ff",
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
    void openExternalHttps(url, shell).catch((error) => {
      console.warn("Control blocked an external window-open URL.", error);
    });
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
      // tintColor uses #RRGGBBAA byte order (verified in
      // electron-liquid-glass/src/glass_effect.mm). Keep alpha at zero, but
      // use the module's opaque backing so Control is an app surface instead
      // of a full-window lens over whatever sits behind it.
      cornerRadius: 30,
      tintColor: "#FFFFFF00",
      opaque: true
    });

    if (liquidGlassViewId >= 0) {
      // Avoid private material variants by default. Some variants shift hard
      // cyan/yellow between active and inactive window states on macOS 26.
      liquidGlass.unstable_setScrim(liquidGlassViewId, 0);
      liquidGlass.unstable_setSubdued(liquidGlassViewId, 0);
    }
  } catch (error) {
    console.warn("Control could not apply native liquid glass.", error);
  }
}

app.commandLine.appendSwitch("enable-features", "PlatformHEVCDecoderSupport");
nativeTheme.themeSource = "light";

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  void bootstrap();
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  const store = await createLocalStore(app.getPath("userData"));
  const github = new GitHubProviderManager(
    store,
    (nameWithOwner) => {
      sendMainToRendererEvent(mainWindow?.webContents, "githubRepositoriesUpdated", { nameWithOwner });
    },
    (appState) => {
      sendMainToRendererEvent(mainWindow?.webContents, "githubAuthUpdated", { appState });
    }
  );
  app.once("before-quit", () => {
    github.close();
    store.close();
  });
  const gateway = new GatewayManager(store, app.getPath("userData"));
  const backendLogger = {
    error: (message: string, cause: unknown) => console.error(message, cause)
  };
  const effectRuntime = createAppRuntime({
    store,
    github,
    externalLinks: shell,
    logger: backendLogger
  });
  const effectBridge = createEffectIpcBridge(effectRuntime, backendLogger);
  const areaManager = new AreaManager(
    store,
    github,
    {
      onAreasUpdated: (event) => sendMainToRendererEvent(mainWindow?.webContents, "areasUpdated", event),
      onAreaRepositoryUpdated: (event) =>
        sendMainToRendererEvent(mainWindow?.webContents, "areaRepositoryUpdated", event),
      onAreaWorkspaceUpdated: (event) =>
        sendMainToRendererEvent(mainWindow?.webContents, "areaWorkspaceUpdated", event)
    },
    gateway
  );
  await areaManager.initialize();

  registerControlIpc({ ipcMain, store, github, effectBridge });
  registerAreaIpc(areaManager);
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
