// Zero-dependency static server for the built OffPeak PWA (dist/), plus a
// reverse proxy for ComEd's API under /comed (the ServletFeed endpoint sends no
// CORS headers, so the browser must reach it same-origin). Runs under pm2 (see
// ecosystem.config.cjs); put nginx in front and proxy the domain to PORT.
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist");
const PORT = process.env.PORT || 8127;
const COMED_HOST = "hourlypricing.comed.com";

// Load DEPLOY_PATH/.env (KEY=VALUE) — server-side provider secrets (ERCOT),
// written by the deploy, never committed.
try {
  for (const line of readFileSync(join(__dirname, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no .env — fine in dev
}

// ERCOT public API: OAuth (ROPC) id_token + subscription key, both required.
const ERCOT_TOKEN_URL =
  "https://ercotb2c.b2clogin.com/ercotb2c.onmicrosoft.com/B2C_1_PUBAPI-ROPC-FLOW/oauth2/v2.0/token";
const ERCOT_CLIENT_ID = "fec253ea-0d06-4272-a5e6-b478baeecd70";
const ERCOT_API_BASE = "https://api.ercot.com/api/public-reports";
let ercotToken = null; // { token, exp }
const ercotCache = new Map();

// CAISO OASIS: trading-hub nodes by short zone code, and a small in-memory
// cache so we hit OASIS at most once per TTL per zone (it rate-limits hard).
const CAISO_HOST = "oasis.caiso.com";
const CAISO_TZ = "America/Los_Angeles";
const CAISO_ZONES = {
  NP15: "TH_NP15_GEN-APND",
  SP15: "TH_SP15_GEN-APND",
  ZP26: "TH_ZP26_GEN-APND",
};
const caisoCache = new Map(); // key -> { at, body }

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/** Long-cache hashed build assets; never cache the app shell / SW / manifest. */
function cacheControl(pathname) {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (/\.(png|svg|ico|woff2?|jpg)$/.test(pathname)) return "public, max-age=86400";
  return "no-cache";
}

async function tryFile(path) {
  try {
    const s = await stat(path);
    return s.isFile() ? path : null;
  } catch {
    return null;
  }
}

/** Proxy GET /comed/<path> → https://hourlypricing.comed.com/<path>. */
function proxyComed(req, res) {
  const upstreamPath = req.url.replace(/^\/comed/, "") || "/";
  const upstream = httpsRequest(
    {
      host: COMED_HOST,
      path: upstreamPath,
      method: "GET",
      headers: { Accept: req.headers["accept"] || "*/*", "User-Agent": "OffPeak/1.0" },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, {
        "Content-Type": up.headers["content-type"] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Upstream error");
  });
  upstream.end();
}

// --- CAISO OASIS → clean JSON -------------------------------------------------

/** GET a binary body from a host (returns a Buffer). */
function fetchBuffer(host, path) {
  return new Promise((resolve, reject) => {
    const r = httpsRequest(
      { host, path, method: "GET", headers: { "User-Agent": "OffPeak/1.0" } },
      (up) => {
        if (up.statusCode !== 200) {
          up.resume();
          return reject(new Error(`upstream ${up.statusCode}`));
        }
        const chunks = [];
        up.on("data", (c) => chunks.push(c));
        up.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );
    r.on("error", reject);
    r.setTimeout(20000, () => r.destroy(new Error("timeout")));
    r.end();
  });
}

/** Extract the single file from an OASIS zip (zero-dep). */
function unzipSingle(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error("not a zip");
  const flags = buf.readUInt16LE(6);
  const method = buf.readUInt16LE(8);
  let compSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + nameLen + extraLen;
  if (compSize === 0 || flags & 0x08) {
    const cen = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    compSize = buf.readUInt32LE(cen + 20);
  }
  const comp = buf.subarray(dataStart, dataStart + compSize);
  return method === 0 ? comp : inflateRawSync(comp);
}

function fmtGmt(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}-0000`;
}

/** RT 5-min LMP_PRC → [{ millisUTC, price¢/kWh }] (mirrors ComEd's feed shape). */
function parseRt(xml) {
  const out = [];
  for (const b of xml.split("<REPORT_DATA>")) {
    if (!b.includes("<DATA_ITEM>LMP_PRC</DATA_ITEM>")) continue;
    const t = b.match(/<INTERVAL_START_GMT>([^<]+)</);
    const v = b.match(/<VALUE>([^<]+)</);
    if (!t || !v) continue;
    out.push({
      millisUTC: new Date(t[1]).getTime(),
      price: Number((parseFloat(v[1]) / 10).toFixed(2)),
    });
  }
  return out.sort((a, b) => a.millisUTC - b.millisUTC);
}

/** Pacific {ymd,hour} for a Date. */
function pacific(d) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAISO_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t).value;
  return { ymd: `${g("year")}${g("month")}${g("day")}`, hour: parseInt(g("hour"), 10) % 24 };
}

/** DAM hourly LMP_PRC for one Pacific date → [{ hour, price¢/kWh }]. */
function parseDam(xml, ymd) {
  const out = [];
  for (const b of xml.split("<REPORT_DATA>")) {
    if (!b.includes("<DATA_ITEM>LMP_PRC</DATA_ITEM>")) continue;
    const t = b.match(/<INTERVAL_START_GMT>([^<]+)</);
    const v = b.match(/<VALUE>([^<]+)</);
    if (!t || !v) continue;
    const pac = pacific(new Date(t[1]));
    if (pac.ymd !== ymd) continue;
    out.push({ hour: pac.hour, price: Number((parseFloat(v[1]) / 10).toFixed(2)) });
  }
  return out.sort((a, b) => a.hour - b.hour);
}

async function getCaisoXml(key, path, ttlMs) {
  const c = caisoCache.get(key);
  if (c && Date.now() - c.at < ttlMs) return c.xml;
  const buf = await fetchBuffer(CAISO_HOST, path);
  const xml = unzipSingle(buf).toString("utf8");
  caisoCache.set(key, { at: Date.now(), xml });
  return xml;
}

async function handleCaiso(req, res, url) {
  const seg = url.pathname.replace(/^\/caiso\//, "");
  const zone = (url.searchParams.get("zone") || "NP15").toUpperCase();
  const node = CAISO_ZONES[zone] || CAISO_ZONES.NP15;
  try {
    let data;
    if (seg === "rt") {
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 3600_000);
      const path = `/oasisapi/SingleZip?queryname=PRC_INTVL_LMP&version=3&market_run_id=RTM&node=${node}&startdatetime=${fmtGmt(start)}&enddatetime=${fmtGmt(now)}`;
      data = parseRt(await getCaisoXml(`rt:${zone}`, path, 60_000));
    } else if (seg === "dam") {
      const ymd = (url.searchParams.get("date") || "").replace(/[^0-9]/g, "");
      if (!/^\d{8}$/.test(ymd)) {
        res.writeHead(400);
        return res.end("bad date");
      }
      const startD = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8), 6));
      const endD = new Date(startD.getTime() + 27 * 3600_000);
      const path = `/oasisapi/SingleZip?queryname=PRC_LMP&version=1&market_run_id=DAM&node=${node}&startdatetime=${fmtGmt(startD)}&enddatetime=${fmtGmt(endD)}`;
      data = parseDam(await getCaisoXml(`dam:${zone}:${ymd}`, path, 1800_000), ymd);
    } else {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  } catch {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end("[]");
  }
}

// --- ERCOT public API → clean JSON --------------------------------------------

/** Mint + cache the ERCOT id_token (ROPC; valid 1h, no refresh). */
async function ercotIdToken() {
  if (ercotToken && Date.now() < ercotToken.exp) return ercotToken.token;
  const body = new URLSearchParams({
    grant_type: "password",
    username: process.env.ERCOT_USERNAME || "",
    password: process.env.ERCOT_PASSWORD || "",
    client_id: ERCOT_CLIENT_ID,
    scope: `openid ${ERCOT_CLIENT_ID} offline_access`,
    response_type: "id_token",
  });
  const res = await fetch(ERCOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token ${res.status}: ${text.slice(0, 200)}`);
  const token = JSON.parse(text).id_token;
  if (!token) throw new Error("no id_token in response");
  ercotToken = { token, exp: Date.now() + 55 * 60_000 };
  return token;
}

/** GET an ERCOT public-report path (relative to ERCOT_API_BASE) → parsed JSON. */
async function ercotGet(path) {
  const token = await ercotIdToken();
  const res = await fetch(`${ERCOT_API_BASE}/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Ocp-Apim-Subscription-Key": process.env.ERCOT_SUBSCRIPTION_KEY || "",
      Accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`api ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function handleErcot(req, res, url) {
  const seg = url.pathname.replace(/^\/ercot\//, "");
  try {
    // Discovery passthrough: /ercot/raw?path=<url-encoded report path + query>.
    if (seg === "raw") {
      const path = url.searchParams.get("path") ?? "";
      const j = await ercotGet(path);
      if (j && Array.isArray(j.data)) j.data = j.data.slice(0, 3); // truncate
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(j));
    }
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(String(e && e.message ? e.message : e).slice(0, 400));
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/comed/") || req.url === "/comed") {
      return proxyComed(req, res);
    }
    if (req.url.startsWith("/caiso/")) {
      return handleCaiso(req, res, new URL(req.url, "http://localhost"));
    }
    if (req.url.startsWith("/ercot/")) {
      return handleErcot(req, res, new URL(req.url, "http://localhost"));
    }

    const url = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(DIST, safe);
    if (!filePath.startsWith(DIST)) filePath = join(DIST, "index.html");

    let resolved = await tryFile(filePath);
    if (!resolved && !extname(safe)) resolved = await tryFile(join(DIST, "index.html"));
    if (!resolved) resolved = await tryFile(join(DIST, "index.html"));
    if (!resolved) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const body = await readFile(resolved);
    const servedPath = resolved === join(DIST, "index.html") ? "/index.html" : pathname;
    res.writeHead(200, {
      "Content-Type": MIME[extname(resolved)] || "application/octet-stream",
      "Cache-Control": cacheControl(servedPath),
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error");
    console.error(err);
  }
});

server.listen(PORT, () => console.log(`OffPeak serving dist/ on :${PORT}`));
