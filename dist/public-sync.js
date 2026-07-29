(function () {
  const params = new URLSearchParams(window.location.search);
  const peerMode =
    window.location.hostname.endsWith("github.io") ||
    params.get("sync") === "peer" ||
    params.get("sync") === "p2p";

  if (!peerMode || window.__SS4_PUBLIC_SYNC__) return;

  const nativeFetch = window.fetch.bind(window);
  const appChannelName = "ss4-display-sync";
  const appStateKey = "ss4-display-state";
  const roomRaw =
    params.get("room") ||
    window.location.pathname.replace(/^\/|\/$/g, "") ||
    "ss4-public";
  const room = roomRaw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "ss4-public";
  const storageKey = `ss4-public-sync-state:${room}`;
  const hostId = `ss4-${room}-host`;
  const clientId =
    crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let peer = null;
  let isHost = false;
  let hostConn = null;
  let reconnectTimer = null;
  const conns = new Map();

  const readInitialState = () => {
    try {
      const queryState = params.get("state");
      if (queryState) {
        const parsed = JSON.parse(queryState);
        if (parsed && parsed.config) return normalizeState(parsed);
      }
    } catch {}
    for (const key of [storageKey, appStateKey]) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
        if (parsed && parsed.config) return normalizeState(parsed);
      } catch {}
    }
    return { version: 0, config: null, stage: null, sourceId: "ss4-peer-init" };
  };

  let state = readInitialState();

  function normalizeState(payload) {
    return {
      version: Number(payload.version) || 0,
      config: payload.config || null,
      stage: payload.stage || "testing",
      sourceId: payload.sourceId || "ss4-peer",
      updatedAt: payload.updatedAt || Date.now(),
    };
  }

  function persistState() {
    try {
      const serialized = JSON.stringify(state);
      window.localStorage.setItem(storageKey, serialized);
      window.localStorage.setItem(
        appStateKey,
        JSON.stringify({ config: state.config, stage: state.stage })
      );
    } catch {}
  }

  function publishLocal() {
    try {
      const channel = new BroadcastChannel(appChannelName);
      channel.postMessage({ config: state.config, stage: state.stage });
      channel.close();
    } catch {}
  }

  function sameState(next) {
    return (
      JSON.stringify(next.config) === JSON.stringify(state.config) &&
      next.stage === state.stage
    );
  }

  function applyState(payload, fromConn) {
    const next = normalizeState(payload || {});
    if (!next.config) return;
    if (!isHost && next.version <= state.version && sameState(next)) return;

    if (isHost && fromConn) {
      next.version = Math.max(state.version + 1, next.version);
      next.sourceId = next.sourceId || clientId;
    }

    state = next.version <= state.version && !sameState(next)
      ? { ...next, version: state.version + 1 }
      : next;
    persistState();
    publishLocal();

    if (isHost) broadcastState(fromConn);
  }

  function response(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  window.fetch = async function ss4PublicFetch(input, init) {
    const requestUrl =
      typeof input === "string"
        ? new URL(input, window.location.href)
        : new URL(input.url, window.location.href);
    if (requestUrl.pathname === "/api/state") {
      const method = ((init && init.method) || "GET").toUpperCase();
      if (method === "POST") {
        try {
          const body = JSON.parse((init && init.body) || "{}");
          applyState({
            ...body,
            version: state.version + 1,
            sourceId: body.sourceId || clientId,
            updatedAt: Date.now(),
          });
          if (!isHost) send(hostConn, { type: "state", state });
        } catch {}
      }
      return response(state);
    }
    return nativeFetch(input, init);
  };

  function send(conn, message) {
    if (conn && conn.open) {
      try {
        conn.send(message);
      } catch {}
    }
  }

  function broadcastState(exceptConn) {
    for (const conn of conns.values()) {
      if (conn !== exceptConn) send(conn, { type: "state", state });
    }
  }

  function setupConn(conn) {
    conns.set(conn.peer, conn);
    conn.on("open", () => {
      send(conn, { type: "hello", id: clientId });
      if (state.config) send(conn, { type: "state", state });
    });
    conn.on("data", (message) => {
      if (!message || typeof message !== "object") return;
      if (message.type === "hello") send(conn, { type: "state", state });
      if (message.type === "state") applyState(message.state, conn);
    });
    conn.on("close", () => conns.delete(conn.peer));
    conn.on("error", () => conns.delete(conn.peer));
  }

  function loadPeerJs() {
    if (window.Peer) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function peerOptions() {
    return {
      host: "0.peerjs.com",
      port: 443,
      path: "/",
      secure: true,
      debug: 0,
    };
  }

  function scheduleClientReconnect() {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(startClient, 2000);
  }

  function startHost() {
    isHost = false;
    peer = new Peer(hostId, peerOptions());
    peer.on("open", () => {
      isHost = true;
      window.__SS4_PUBLIC_SYNC__.role = "host";
      if (state.config) persistState();
    });
    peer.on("connection", setupConn);
    peer.on("error", (error) => {
      if (String(error && error.type).includes("unavailable-id")) {
        try {
          peer.destroy();
        } catch {}
        startClient();
      } else {
        scheduleClientReconnect();
      }
    });
    peer.on("disconnected", () => {
      try {
        peer.reconnect();
      } catch {
        scheduleClientReconnect();
      }
    });
  }

  function startClient() {
    isHost = false;
    window.__SS4_PUBLIC_SYNC__.role = "client";
    try {
      if (peer && !peer.destroyed) peer.destroy();
    } catch {}
    peer = new Peer(undefined, peerOptions());
    peer.on("open", () => {
      hostConn = peer.connect(hostId, { reliable: true });
      setupConn(hostConn);
    });
    peer.on("error", scheduleClientReconnect);
    peer.on("disconnected", scheduleClientReconnect);
  }

  window.__SS4_PUBLIC_SYNC__ = {
    enabled: true,
    room,
    role: "starting",
    getState: () => state,
  };

  persistState();
  loadPeerJs()
    .then(startHost)
    .catch(() => {
      window.__SS4_PUBLIC_SYNC__.role = "offline";
    });
})();
