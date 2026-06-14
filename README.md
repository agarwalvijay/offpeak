# OffPeak

Real-time **ComEd hourly electricity pricing** — know when power is cheap so you
can shift usage to off-peak. One TypeScript codebase, two faces:

- **Web** (`/`, `src/`): Vite + React + PWA — a full-screen, responsive pricing
  dashboard (live price, statistics, 5-minute trend, day-ahead forecast).
- **Mobile** (`mobile/`): Expo app presenting the same dashboard, plus a native
  Android home-screen price widget.

The ComEd API client and all pricing/alert/chart logic live once in
**`mobile/src/lib`** (the web app aliases it as `@/lib`), so web and mobile can
never drift apart.

```
src/                 web UI (React DOM)
mobile/              Expo app (WebView shell) + Android widget
mobile/src/lib/      shared logic — single source of truth
server.js            zero-dep prod server (static + /comed proxy)
deploy/              nginx vhost + SETUP.md
legacy/              the previous Streamlit + Flutter apps (archived)
```

See **[deploy/SETUP.md](deploy/SETUP.md)** for development, deployment, and
mobile build instructions.
