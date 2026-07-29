const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3366);
const WEB_ROOT = path.join(__dirname, "dist");
const INDEX_FILE = path.join(WEB_ROOT, "index.html");

const defaultConfig = {
  fov: 110,
  fovMode: false,
  showHorizon: false,
  showReticle: false,
  showCabin: false,
  showDots: false,
  edgeDotsMode: "dense",
  vignette: false,
  vignetteMode: "table",
  grfLevel: "s1",
  vignetteOpacity: 0.6,
  vignetteRange: 0.4,
  vignetteCurve: "gamma",
  blurEdge: false,
  blurColor: "black",
  blurOpacity: 0.2,
  blurRadius: 20,
  blurRange: 0.2,
  blurCurve: "soft",
  lowDetail: false,
  displayType: "triple",
  isMoving: false,
  motionStartedAt: null,
  infoLoad: "none"
};

let state = {
  version: 0,
  sourceId: "server",
  updatedAt: Date.now(),
  stage: "testing",
  config: defaultConfig
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

function sendJson(res, payload, statusCode = 200) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  setCors(res);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length
  });
  res.end(body);
}

function sendText(res, text, statusCode = 200) {
  const body = Buffer.from(text, "utf8");
  setCors(res);
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length
  });
  res.end(body);
}

function resolveStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  if (decodedPath === "/") return INDEX_FILE;

  const relativePath = decodedPath.replace(/^\/+/, "");
  const candidate = path.resolve(WEB_ROOT, relativePath);
  const root = path.resolve(WEB_ROOT);

  if (!candidate.startsWith(root)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (!path.extname(candidate)) return INDEX_FILE;
  return null;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    if (requestUrl.pathname === "/api/state" && req.method === "GET") {
      sendJson(res, state);
      return;
    }

    if (requestUrl.pathname === "/api/state" && req.method === "POST") {
      const body = await readRequestBody(req);
      const payload = JSON.parse(body || "{}");

      if (payload && payload.config) {
        state = {
          version: state.version + 1,
          sourceId: String(payload.sourceId || "unknown"),
          updatedAt: Date.now(),
          stage: payload.stage ? String(payload.stage) : state.stage,
          config: payload.config
        };
      }

      sendJson(res, state);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      sendText(res, "Not Found", 404);
      return;
    }

    const filePath = resolveStaticPath(requestUrl.pathname);
    if (!filePath) {
      sendText(res, "Not Found", 404);
      return;
    }

    const bytes = fs.readFileSync(filePath);
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": bytes.length
    });
    res.end(bytes);
  } catch (error) {
    sendText(res, error && error.message ? error.message : "Internal Server Error", 500);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SS4.0 public sync server is running on port ${PORT}`);
});
