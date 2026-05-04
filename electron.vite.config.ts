import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ["better-sqlite3", "electron-liquid-glass", "keytar"]
      }
    },
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ["electron"]
      }
    },
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
        "@renderer": resolve("src/renderer/src")
      }
    }
  }
});
