// Zero-dependency static server for the built OffPeak PWA (dist/), plus a
// reverse proxy for ComEd's API under /comed (the ServletFeed endpoint sends no
// CORS headers, so the browser must reach it same-origin). Runs under pm2 (see
// ecosystem.config.cjs); put nginx in front and proxy the domain to PORT.
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { stat, readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist");
const PORT = process.env.PORT || 8127;
const COMED_HOST = "hourlypricing.comed.com";

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

const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/comed/") || req.url === "/comed") {
      return proxyComed(req, res);
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
