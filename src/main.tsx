import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fetchEnabledMarkets,
  parseMarkets,
  setComedBaseUrl,
  setEnabledUtilities,
} from "@/lib";
import { App } from "./App";
import "./index.css";

// ComEd's /rrtp/ServletFeed endpoint has no CORS headers, so the web app routes
// all ComEd traffic through a same-origin proxy (vite in dev/preview, server.js
// in production). Native apps keep hitting ComEd directly.
setComedBaseUrl("/comed");

// The bundle's build-time market list (VITE_OFFPEAK_MARKETS) is the immediate
// fallback; the server's live /config is the source of truth so an installed /
// cached app reflects the current config on launch, not whatever was baked into
// the bundle it happens to be running. Unset → every market.
setEnabledUtilities(parseMarkets(import.meta.env.VITE_OFFPEAK_MARKETS));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

function render() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

// Prefer the live list, but never block startup on it: a non-empty result
// overrides the baked fallback; a failure/timeout keeps it. Either way render.
fetchEnabledMarkets()
  .then((markets) => {
    if (markets.length) setEnabledUtilities(markets);
  })
  .finally(render);
