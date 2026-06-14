// PM2 process definition for the OffPeak web PWA.
// Serves the built dist/ (and the /comed proxy) via the zero-dependency
// server.js. Behind nginx, proxy offpeak.atsumilabs.com to PORT.
//
//   pm2 start ecosystem.config.cjs       # first time
//   pm2 reload ecosystem.config.cjs      # zero-downtime reload (used by CI)
module.exports = {
  apps: [
    {
      name: "offpeak",
      script: "server.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production",
        // Skyfield uses 8125, tadkaplay 8123 — OffPeak gets 8127.
        PORT: 8127,
      },
    },
  ],
};
