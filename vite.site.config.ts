import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "site",
  plugins: [react()],
  resolve: {
    alias: {
      "@site": resolve("site/src")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 4173
  }
});
