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

// Which markets this deployment serves. OFFPEAK_MARKETS (a comma-separated id
// list from the GitHub repo variable, written into .env by the deploy) is the
// server-side source of truth — the client UI hides disabled markets, but the
// server must also refuse their data endpoints so a stale/crafted request can't
// reach a disabled provider. Unset / all-invalid → every market (fail-open, to
// match the client). Must stay in sync with mobile/src/lib/provider.ts ids.
const ALL_MARKETS = ["comed", "caiso", "ercot", "nyiso", "isone", "pjm"];
const enabledMarkets = (() => {
  const ids = (process.env.OFFPEAK_MARKETS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => ALL_MARKETS.includes(s));
  return new Set(ids.length ? ids : ALL_MARKETS);
})();
const marketEnabled = (id) => enabledMarkets.has(id);

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

const ERCOT_HUBS = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_HUBAVG"];

/** Map field names → column indices for an ERCOT report response. */
function fieldIndex(json) {
  const idx = {};
  (json.fields || []).forEach((f, i) => (idx[f.name] = i));
  return idx;
}

/** YYYY-MM-DD for a Date in US Central (ERCOT delivery dates are Central). */
function centralDateStr(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** UTC ms for a Central wall-clock time (handles DST). */
function chicagoWallToUtcMs(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(guess));
  const g = (t) => +parts.find((p) => p.type === t).value;
  const wall = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  return guess - (wall - guess);
}

/** RT SPP rows → [{ millisUTC, price¢/kWh }]. 15-min settlement intervals. */
function parseErcotRt(json) {
  const i = fieldIndex(json);
  const out = [];
  for (const r of json.data || []) {
    const [y, mo, d] = String(r[i.deliveryDate]).split("-").map(Number);
    const hour = Number(r[i.deliveryHour]); // 1-24 (hour ending)
    const intvl = Number(r[i.deliveryInterval]); // 1-4
    const price = Number(r[i.settlementPointPrice]);
    const ms = chicagoWallToUtcMs(y, mo, d, hour - 1, (intvl - 1) * 15);
    out.push({ millisUTC: ms, price: Number((price / 10).toFixed(2)) });
  }
  return out.sort((a, b) => a.millisUTC - b.millisUTC);
}

/** DAM SPP rows → [{ hour, price¢/kWh }]. */
function parseErcotDam(json) {
  const i = fieldIndex(json);
  const out = [];
  for (const r of json.data || []) {
    const hour = (parseInt(String(r[i.hourEnding]), 10) - 1 + 24) % 24;
    const price = Number(r[i.settlementPointPrice]);
    out.push({ hour, price: Number((price / 10).toFixed(2)) });
  }
  return out.sort((a, b) => a.hour - b.hour);
}

function ercotHub(url) {
  const z = (url.searchParams.get("zone") || "HB_HOUSTON").toUpperCase();
  return ERCOT_HUBS.includes(z) ? z : "HB_HOUSTON";
}

async function handleErcot(req, res, url) {
  const seg = url.pathname.replace(/^\/ercot\//, "");
  try {
    if (seg === "rt") {
      const hub = ercotHub(url);
      const key = `rt:${hub}`;
      const c = ercotCache.get(key);
      let data;
      if (c && Date.now() - c.at < 60_000) data = c.data;
      else {
        const now = new Date();
        const from = centralDateStr(new Date(now.getTime() - 24 * 3600_000));
        const to = centralDateStr(now);
        const json = await ercotGet(
          `np6-905-cd/spp_node_zone_hub?deliveryDateFrom=${from}&deliveryDateTo=${to}&settlementPoint=${hub}&size=1000`,
        );
        data = parseErcotRt(json);
        ercotCache.set(key, { at: Date.now(), data });
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    if (seg === "dam") {
      const hub = ercotHub(url);
      const ymd = (url.searchParams.get("date") || "").replace(/[^0-9]/g, "");
      if (!/^\d{8}$/.test(ymd)) {
        res.writeHead(400);
        return res.end("bad date");
      }
      const ds = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      const key = `dam:${hub}:${ymd}`;
      const c = ercotCache.get(key);
      let data;
      if (c && Date.now() - c.at < 1800_000) data = c.data;
      else {
        const json = await ercotGet(
          `np4-190-cd/dam_stlmnt_pnt_prices?deliveryDateFrom=${ds}&deliveryDateTo=${ds}&settlementPoint=${hub}&size=100`,
        );
        data = parseErcotDam(json);
        ercotCache.set(key, { at: Date.now(), data });
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    // Discovery passthrough: /ercot/raw?path=<url-encoded report path + query>.
    if (seg === "raw") {
      const path = url.searchParams.get("path") ?? "";
      const j = await ercotGet(path);
      if (j && Array.isArray(j.data)) j.data = j.data.slice(0, 3);
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

// --- ISO-NE web services (HTTP Basic) → clean JSON ----------------------------

const ISONE_BASE = "https://webservices.iso-ne.com/api/v1.1";
const isoneCache = new Map();

async function isoneGet(path) {
  const auth = Buffer.from(
    `${process.env.ISONE_USERNAME || ""}:${process.env.ISONE_PASSWORD || ""}`,
  ).toString("base64");
  const res = await fetch(`${ISONE_BASE}/${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`isone ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// Hub + load-zone location IDs.
const ISONE_LOCS = ["4000", "4001", "4002", "4003", "4004", "4005", "4006", "4007", "4008"];
function isoneLoc(url) {
  const z = url.searchParams.get("zone") || "4000";
  return ISONE_LOCS.includes(z) ? z : "4000";
}

function asArray(x) {
  return Array.isArray(x) ? x : x ? [x] : [];
}

/** RT 5-min LMPs → [{ millisUTC, price¢/kWh }]. BeginDate is ISO with offset. */
function parseIsoneRt(json) {
  return asArray(json && json.FiveMinLmps && json.FiveMinLmps.FiveMinLmp)
    .map((x) => ({ millisUTC: Date.parse(x.BeginDate), price: Number((x.LmpTotal / 10).toFixed(2)) }))
    .filter((p) => !Number.isNaN(p.millisUTC))
    .sort((a, b) => a.millisUTC - b.millisUTC);
}

/** DAM hourly LMPs → [{ hour, price¢/kWh }] (hour from the Eastern timestamp). */
function parseIsoneDam(json) {
  return asArray(json && json.HourlyLmps && json.HourlyLmps.HourlyLmp)
    .map((x) => ({ hour: parseInt(String(x.BeginDate).slice(11, 13), 10), price: Number((x.LmpTotal / 10).toFixed(2)) }))
    .sort((a, b) => a.hour - b.hour);
}

async function handleIsone(req, res, url) {
  const seg = url.pathname.replace(/^\/isone\//, "");
  try {
    if (seg === "rt") {
      const loc = isoneLoc(url);
      const key = `rt:${loc}`;
      const c = isoneCache.get(key);
      let data;
      if (c && Date.now() - c.at < 60_000) data = c.data;
      else {
        const today = easternYmd(new Date());
        const yest = easternYmd(new Date(Date.now() - 24 * 3600_000));
        const [a, b] = await Promise.all([
          isoneGet(`fiveminutelmp/day/${yest}/location/${loc}`).catch(() => ({})),
          isoneGet(`fiveminutelmp/day/${today}/location/${loc}`),
        ]);
        data = [...parseIsoneRt(a), ...parseIsoneRt(b)].sort((x, y) => x.millisUTC - y.millisUTC);
        isoneCache.set(key, { at: Date.now(), data });
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    if (seg === "dam") {
      const loc = isoneLoc(url);
      const ymd = (url.searchParams.get("date") || "").replace(/[^0-9]/g, "");
      if (!/^\d{8}$/.test(ymd)) {
        res.writeHead(400);
        return res.end("bad date");
      }
      const key = `dam:${loc}:${ymd}`;
      const c = isoneCache.get(key);
      let data;
      if (c && Date.now() - c.at < 1800_000) data = c.data;
      else {
        const json = await isoneGet(`hourlylmp/da/final/day/${ymd}/location/${loc}`);
        data = parseIsoneDam(json);
        isoneCache.set(key, { at: Date.now(), data });
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    // Discovery passthrough: /isone/raw?path=<url-encoded path>.
    if (seg === "raw") {
      const path = url.searchParams.get("path") ?? "";
      const j = await isoneGet(path);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(j).slice(0, 4000));
    }
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(String(e && e.message ? e.message : e).slice(0, 400));
  }
}

// --- NYISO public CSV → clean JSON --------------------------------------------

const nyisoCache = new Map();
const NYISO_ZONES = [
  "N.Y.C.", "LONGIL", "WEST", "CAPITL", "CENTRL",
  "HUD VL", "MILLWD", "DUNWOD", "GENESE", "MHK VL", "NORTH",
];

function nyisoZone(url) {
  const z = url.searchParams.get("zone") || "N.Y.C.";
  return NYISO_ZONES.includes(z) ? z : "N.Y.C.";
}

/** UTC ms for a wall-clock time in an IANA timezone (handles DST). */
function wallToUtcMs(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(guess));
  const g = (t) => +parts.find((p) => p.type === t).value;
  const wall = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  return guess - (wall - guess);
}

/** YYYYMMDD for a Date in US Eastern (NYISO files are Eastern). */
function easternYmd(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, "");
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": "OffPeak/1.0" } });
  if (!r.ok) throw new Error(`nyiso ${r.status}`);
  return r.text();
}

function csvRow(line) {
  return line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
}

/** RT zonal LBMP CSV ("MM/DD/YYYY HH:MM:SS",Name,PTID,LBMP,...) → [{millisUTC,price}]. */
function parseNyisoRt(csv, zone) {
  const out = [];
  const lines = csv.split("\n");
  for (let k = 1; k < lines.length; k++) {
    const line = lines[k].trim();
    if (!line) continue;
    const f = csvRow(line);
    if (f[1] !== zone) continue;
    const m = f[0].match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
    const price = parseFloat(f[3]);
    if (!m || Number.isNaN(price)) continue;
    const ms = wallToUtcMs(+m[3], +m[1], +m[2], +m[4], +m[5], "America/New_York");
    out.push({ millisUTC: ms, price: Number((price / 10).toFixed(2)) });
  }
  return out.sort((a, b) => a.millisUTC - b.millisUTC);
}

/** DAM zonal LBMP CSV ("MM/DD/YYYY HH:MM",Name,PTID,LBMP,...) → [{hour,price}]. */
function parseNyisoDam(csv, zone) {
  const out = [];
  const lines = csv.split("\n");
  for (let k = 1; k < lines.length; k++) {
    const line = lines[k].trim();
    if (!line) continue;
    const f = csvRow(line);
    if (f[1] !== zone) continue;
    const m = f[0].match(/ (\d{2}):(\d{2})/);
    const price = parseFloat(f[3]);
    if (!m || Number.isNaN(price)) continue;
    out.push({ hour: +m[1] % 24, price: Number((price / 10).toFixed(2)) });
  }
  return out.sort((a, b) => a.hour - b.hour);
}

async function handleNyiso(req, res, url) {
  const seg = url.pathname.replace(/^\/nyiso\//, "");
  try {
    if (seg === "rt") {
      const zone = nyisoZone(url);
      const key = `rt:${zone}`;
      const c = nyisoCache.get(key);
      let data;
      if (c && Date.now() - c.at < 60_000) data = c.data;
      else {
        const today = easternYmd(new Date());
        const yest = easternYmd(new Date(Date.now() - 24 * 3600_000));
        const base = "http://mis.nyiso.com/public/csv/realtime";
        const [a, b] = await Promise.all([
          fetchText(`${base}/${yest}realtime_zone.csv`).catch(() => ""),
          fetchText(`${base}/${today}realtime_zone.csv`),
        ]);
        data = [...parseNyisoRt(a, zone), ...parseNyisoRt(b, zone)].sort(
          (x, y) => x.millisUTC - y.millisUTC,
        );
        nyisoCache.set(key, { at: Date.now(), data });
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    if (seg === "dam") {
      const zone = nyisoZone(url);
      const ymd = (url.searchParams.get("date") || "").replace(/[^0-9]/g, "");
      if (!/^\d{8}$/.test(ymd)) {
        res.writeHead(400);
        return res.end("bad date");
      }
      const key = `dam:${zone}:${ymd}`;
      const c = nyisoCache.get(key);
      let data;
      if (c && Date.now() - c.at < 1800_000) data = c.data;
      else {
        const csv = await fetchText(
          `http://mis.nyiso.com/public/csv/damlbmp/${ymd}damlbmp_zone.csv`,
        );
        data = parseNyisoDam(csv, zone);
        nyisoCache.set(key, { at: Date.now(), data });
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(String(e && e.message ? e.message : e).slice(0, 300));
  }
}

// --- PJM Data Miner 2 (subscription key) → clean JSON -------------------------

const PJM_BASE = "https://api.pjm.com/api/v1";
const pjmCache = new Map();

// Pricing-node IDs (RT five-min disallows zone/type filters by data volume, so
// we must query by pnode_id — same IDs work for DA hourly). Default = ComEd, the
// app's heritage zone. Mirror this set in mobile/src/lib/provider.ts.
const PJM_PNODES = new Set([
  "33092371", // ComEd
  "1", // PJM-RTO (system)
  "51288", // Western Hub
  "51297", // PECO
  "51301", // PSEG
  "51292", // BGE
  "51298", // Pepco
  "51299", // PPL
  "34964545", // Dominion (DOM)
]);
const PJM_DEFAULT_PNODE = "33092371";

function pjmPnode(url) {
  const z = url.searchParams.get("zone") || PJM_DEFAULT_PNODE;
  return PJM_PNODES.has(z) ? z : PJM_DEFAULT_PNODE;
}

/** GET a Data Miner feed → its `items` array (subscription key in header). */
async function pjmGet(feed, params) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const r = await fetch(`${PJM_BASE}/${feed}?${qs}`, {
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.PJM_SUBSCRIPTION_KEY || "",
      Accept: "application/json",
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`pjm ${r.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  return Array.isArray(json) ? json : json.items || [];
}

/** Eastern Prevailing Time filter string "MM-DD-YYYY HH:MM" for a Date. */
function eptFilter(d) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t).value;
  const h = g("hour") === "24" ? "00" : g("hour");
  return `${g("month")}-${g("day")}-${g("year")} ${h}:${g("minute")}`;
}

/** RT 5-min total LMP → [{ millisUTC, price¢/kWh }]. utc field is zone-less. */
function parsePjmRt(items) {
  return items
    .map((r) => {
      const t = String(r.datetime_beginning_utc || "");
      return {
        millisUTC: Date.parse(/[zZ]$/.test(t) ? t : `${t}Z`),
        price: Number((Number(r.total_lmp_rt) / 10).toFixed(2)),
      };
    })
    .filter((p) => !Number.isNaN(p.millisUTC))
    .sort((a, b) => a.millisUTC - b.millisUTC);
}

/** DA hourly total LMP → [{ hour, price¢/kWh }] (hour from the EPT timestamp). */
function parsePjmDam(items) {
  return items
    .map((r) => ({
      hour: parseInt(String(r.datetime_beginning_ept).slice(11, 13), 10),
      price: Number((Number(r.total_lmp_da) / 10).toFixed(2)),
    }))
    .filter((x) => !Number.isNaN(x.hour))
    .sort((a, b) => a.hour - b.hour);
}

async function handlePjm(req, res, url) {
  const seg = url.pathname.replace(/^\/pjm\//, "");
  try {
    if (seg === "rt") {
      const pnode = pjmPnode(url);
      const key = `rt:${pnode}`;
      const c = pjmCache.get(key);
      let data;
      if (c && Date.now() - c.at < 60_000) data = c.data;
      else {
        const now = new Date();
        const from = new Date(now.getTime() - 24 * 3600_000);
        // Unverified feed = near-real-time (latest interval ≈ now); the
        // "verified" rt_fivemin_hrl_lmps lags ~a day, so it's wrong for a
        // live price. Unverified isn't versioned (no row_is_current).
        const items = await pjmGet("rt_unverified_fivemin_lmps", {
          rowCount: 50000,
          startRow: 1,
          datetime_beginning_ept: `${eptFilter(from)} to ${eptFilter(now)}`,
          pnode_id: pnode,
          fields: "datetime_beginning_utc,total_lmp_rt",
        });
        data = parsePjmRt(items);
        pjmCache.set(key, { at: Date.now(), data });
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    if (seg === "dam") {
      const pnode = pjmPnode(url);
      const ymd = (url.searchParams.get("date") || "").replace(/[^0-9]/g, "");
      if (!/^\d{8}$/.test(ymd)) {
        res.writeHead(400);
        return res.end("bad date");
      }
      const yyyy = ymd.slice(0, 4);
      const mm = ymd.slice(4, 6);
      const dd = ymd.slice(6, 8);
      const key = `dam:${pnode}:${ymd}`;
      const c = pjmCache.get(key);
      let data;
      if (c && Date.now() - c.at < 1800_000) data = c.data;
      else {
        const items = await pjmGet("da_hrl_lmps", {
          rowCount: 100,
          startRow: 1,
          datetime_beginning_ept: `${mm}-${dd}-${yyyy} 00:00 to ${mm}-${dd}-${yyyy} 23:59`,
          pnode_id: pnode,
          row_is_current: "true",
          fields: "datetime_beginning_ept,total_lmp_da",
        });
        data = parsePjmDam(items);
        pjmCache.set(key, { at: Date.now(), data });
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    // Discovery passthrough: /pjm/raw?path=<url-encoded feed + query>.
    if (seg === "raw") {
      const path = url.searchParams.get("path") ?? "";
      const r = await fetch(`${PJM_BASE}/${path}`, {
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.PJM_SUBSCRIPTION_KEY || "",
          Accept: "application/json",
        },
      });
      const text = await r.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch {
        j = text;
      }
      // Drop the bulky feed schema so items/errors aren't truncated away.
      if (j && typeof j === "object") delete j.feedMetadata;
      if (j && Array.isArray(j.items)) j.items = j.items.slice(0, 30);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(j).slice(0, 12000));
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
    // Runtime client config: the live enabled-markets list (same allowlist the
    // routes below enforce). The client fetches this at launch + when opening
    // settings so an installed/cached app reflects the current config without
    // waiting for a new bundle. Order = config order (first = launch default).
    if (req.url === "/config" || req.url.startsWith("/config?")) {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return res.end(JSON.stringify({ markets: [...enabledMarkets] }));
    }

    // Market data endpoints, each gated on the enabled-markets allowlist:
    // a disabled provider returns 404 (its UI is hidden, but enforce here too).
    const market = (req.url.match(/^\/(comed|caiso|ercot|nyiso|isone|pjm)(?:\/|$)/) || [])[1];
    if (market && !marketEnabled(market)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Market not enabled");
    }
    if (req.url.startsWith("/comed/") || req.url === "/comed") {
      return proxyComed(req, res);
    }
    if (req.url.startsWith("/caiso/")) {
      return handleCaiso(req, res, new URL(req.url, "http://localhost"));
    }
    if (req.url.startsWith("/ercot/")) {
      return handleErcot(req, res, new URL(req.url, "http://localhost"));
    }
    if (req.url.startsWith("/nyiso/")) {
      return handleNyiso(req, res, new URL(req.url, "http://localhost"));
    }
    if (req.url.startsWith("/isone/")) {
      return handleIsone(req, res, new URL(req.url, "http://localhost"));
    }
    if (req.url.startsWith("/pjm/")) {
      return handlePjm(req, res, new URL(req.url, "http://localhost"));
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
