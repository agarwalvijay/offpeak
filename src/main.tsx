import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseMarkets, setComedBaseUrl, setEnabledUtilities } from "@/lib";
import { App } from "./App";
import "./index.css";

// ComEd's /rrtp/ServletFeed endpoint has no CORS headers, so the web app routes
// all ComEd traffic through a same-origin proxy (vite in dev/preview, server.js
// in production). Native apps keep hitting ComEd directly.
setComedBaseUrl("/comed");

// Markets to surface in the UI come from the OFFPEAK_MARKETS build config (a
// GitHub repo variable injected as VITE_OFFPEAK_MARKETS at deploy time). Unset
// → every market. Runs before render so the launch/settings screens see it.
setEnabledUtilities(parseMarkets(import.meta.env.VITE_OFFPEAK_MARKETS));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
