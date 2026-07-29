const WEB_ROOT = new URL("./dist/", import.meta.url);
const INDEX_FILE = new URL("./dist/index.html", import.meta.url);
const STATE_KEY = ["ss4", "state"];

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

let memoryState = {
  version: 0,
  sourceId: "server",
  updatedAt: Date.now(),
  stage: "testing",
  config: defaultConfig
};

const kvPromise = Deno.openKv ? Deno.openKv().catch(() => null) : Promise.resolve(null);

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

function corsHeaders(contentType = "text/plain; charset=utf-8") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Content-Type": contentType
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders("application/json; charset=utf-8")
  });
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: corsHeaders("text/plain; charset=utf-8")
  });
}

async function getState() {
  const kv = await kvPromise;
  if (!kv) return memoryState;
  const saved = await kv.get(STATE_KEY);
  if (saved.value) return saved.value;
  await kv.set(STATE_KEY, memoryState);
  return memoryState;
}

async function setState(payload) {
  const current = await getState();
  if (!payload || !payload.config) return current;

  const next = {
    version: Number(current.version || 0) + 1,
    sourceId: String(payload.sourceId || "unknown"),
    updatedAt: Date.now(),
    stage: payload.stage ? String(payload.stage) : current.stage || "testing",
    config: payload.config
  };

  memoryState = next;
  const kv = await kvPromise;
  if (kv) await kv.set(STATE_KEY, next);
  return next;
}

function extname(pathname) {
  const last = pathname.split("/").pop() || "";
  const dot = last.lastIndexOf(".");
  return dot >= 0 ? last.slice(dot).toLowerCase() : "";
}

async function staticResponse(pathname) {
  let clean = decodeURIComponent(pathname.split("?")[0] || "/");
  if (clean === "/") clean = "/index.html";
  if (!extname(clean)) clean = "/index.html";
  if (clean.includes("..")) return textResponse("Not Found", 404);

  const fileUrl = clean === "/index.html"
    ? INDEX_FILE
    : new URL(`.${clean}`, WEB_ROOT);

  try {
    const bytes = await Deno.readFile(fileUrl);
    const contentType = mimeTypes[extname(clean)] || "application/octet-stream";
    return new Response(bytes, {
      status: 200,
      headers: corsHeaders(contentType)
    });
  } catch {
    return textResponse("Not Found", 404);
  }
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/state" && request.method === "GET") {
      return jsonResponse(await getState());
    }

    if (url.pathname === "/api/state" && request.method === "POST") {
      const payload = await request.json().catch(() => ({}));
      return jsonResponse(await setState(payload));
    }

    if (url.pathname.startsWith("/api/")) {
      return textResponse("Not Found", 404);
    }

    return staticResponse(url.pathname);
  } catch (error) {
    return textResponse(error?.message || "Internal Server Error", 500);
  }
});
