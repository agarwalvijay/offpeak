# OffPeak — deployment & local builds

The repo holds two apps in one TypeScript codebase:

- **Web** (repo root): Vite + React + PWA. Builds to `dist/`, served by the
  zero-dependency `server.js` under pm2 on **port 8127**, behind nginx at
  **offpeak.atsumilabs.com**.
- **Mobile** (`mobile/`): Expo app — a full-screen WebView of the deployed web
  app, plus a native Android home-screen price widget.

Shared ComEd/pricing logic lives in `mobile/src/lib` (the web app aliases it as
`@/lib`), so the two never diverge.

---

## 1. Web deploy (GitHub Actions → server)

On every push to `main`, `.github/workflows/deploy.yml` builds the PWA, rsyncs
the runtime files (`dist/`, `server.js`, `ecosystem.config.cjs`, `package.json`)
to the server, and reloads pm2. It **skips the deploy** until the SSH secrets
are set, so CI stays green in the meantime.

### One-time setup

**a) DNS** — point the subdomain at the server (same box as Skyfield):

```
offpeak.atsumilabs.com.  A  34.31.230.163
```

**b) GitHub Actions secrets** (repo `agarwalvijay/offpeak`):

```bash
gh secret set SSH_HOST   --body "atsumilabs.com"          # or the server IP
gh secret set SSH_USER   --body "<deploy-user>"
gh secret set SSH_PORT   --body "22"
gh secret set DEPLOY_PATH --body "/home/<deploy-user>/offpeak"
gh secret set SSH_KEY    < ~/.ssh/<deploy_private_key>     # private key, PEM
```

The public half of `SSH_KEY` must be in the deploy user's
`~/.ssh/authorized_keys` on the server (the same deploy key Skyfield uses works).

**c) Server** — create the app dir, nginx vhost, TLS, and pm2:

```bash
ssh <deploy-user>@atsumilabs.com
mkdir -p ~/offpeak

# nginx (run from a checkout of this repo, or scp the conf over)
sudo cp deploy/nginx-offpeak.conf /etc/nginx/sites-available/offpeak
sudo ln -sf /etc/nginx/sites-available/offpeak /etc/nginx/sites-enabled/offpeak
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d offpeak.atsumilabs.com

# first deploy populates ~/offpeak, then start pm2
cd ~/offpeak
pm2 start ecosystem.config.cjs
pm2 save
```

### Deploy

```bash
gh workflow run "Deploy to server"     # or just push to main
curl -I https://offpeak.atsumilabs.com
```

---

## 2. Local development (web)

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /comed → ComEd)
npm run build      # tsc + vite build → dist/
npm run preview    # serve the build on :4173
```

> The web app calls ComEd through a same-origin `/comed` proxy because ComEd's
> `ServletFeed` (day-ahead) endpoint sends no CORS headers. The proxy exists in
> `vite.config.ts` (dev/preview) and `server.js` (prod). Native apps hit ComEd
> directly.

---

## 3. Mobile builds (local, no EAS)

Requires Android Studio SDK + **JDK 17** (Android) and Xcode (iOS).

```bash
cd mobile
npm install
npx expo prebuild                 # generates android/ and ios/

# Android
npx expo run:android              # debug on device/emulator
cd android && ./gradlew assembleRelease   # release APK
cd android && ./gradlew bundleRelease     # AAB for Play Store

# iOS (on macOS)
npx expo run:ios
# release: open ios/OffPeak.xcworkspace in Xcode → Archive
```

Bundle id `com.atsumilabs.offpeak`. The Android home-screen widget ("OffPeak
Price") is configured in `app.json` and implemented in `mobile/src/widgets/`.

> Note: a WebView-only iOS app can hit App Store guideline 4.2 ("minimum
> functionality"). The native widget helps; consider adding native screens or
> push alerts before submitting to Apple.
