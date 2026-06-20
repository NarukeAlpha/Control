import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { AuthProvider } from "./components/auth/AuthProvider";
import "./styles.css";

// The native liquid-glass backing only exists inside the Electron app. Renderer-only previews,
// even on macOS, need the CSS fallback so layout screenshots do not flatten into a dark slab.
if (!/Electron/i.test(navigator.userAgent)) {
  document.body.classList.add("no-liquid-glass");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
