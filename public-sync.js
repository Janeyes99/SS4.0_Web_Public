(function () {
  const params = new URLSearchParams(window.location.search);
  const publicMode =
    window.location.hostname.endsWith("github.io") ||
    params.get("sync") === "public" ||
    params.get("sync") === "ntfy";

  if (!publicMode || window.__SS4_PUBLIC_SYNC__) return;

  const nativeFetch = window.fetch.bind(window);
  const appChannelName = "ss4-display-sync";
  const appStateKey = "ss4-display-state";
  const roomRaw = params.get("room") || "test01";
  const room =
    roomRaw
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "ss4-public";
  const topic = `ss4-sync-${hashRoom(room)}`;
  const relayBase = `https://ntfy.sh/${topic}`;
  const storageKey = `ss4-public-sync-state:${room}`;
  const clientId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let state = readInitialState();
  let connected = false;
  let lastReceivedAt = 0;
  let lastSentAt = 0;
  let lastRelayTime = 0;
  let pendingPublishTimer = null;
  let pendingPublishState = null;
  let pollTimer = null;
  const seenRelayIds = new Set();

  window.__SS4_PUBLIC_SYNC__ = {
    enabled: true,
    mode: "ntfy",
    room,
    topic,
    status: "starting",
    getState: () => state,
  };

  function hashRoom(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function normalizeState(payload) {
    return {
      version: Number(payload.version) || 0,
      config: payload.config || null,
      stage: payload.stage || "testing",
      sourceId: payload.sourceId || "ss4-public",
      updatedAt: payload.updatedAt || Date.now(),
    };
  }

  function readInitialState() {
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
    return {
      version: 0,
      config: null,
      stage: null,
      sourceId: "ss4-public-init",
      updatedAt: Date.now(),
    };
  }

  function sameState(next) {
    return (
      JSON.stringify(next.config) === JSON.stringify(state.config) &&
      next.stage === state.stage
    );
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

  function setStatus(nextStatus) {
    window.__SS4_PUBLIC_SYNC__.status = nextStatus;
    updateStatusBadge();
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

  function applyState(payload, shouldPublishRemote) {
    const next = normalizeState(payload || {});
    if (!next.config) return;
    if (next.version < state.version) return;
    if (next.version === state.version && sameState(next)) return;

    state = next;
    persistState();
    publishLocal();
    if (shouldPublishRemote) scheduleRemotePublish(state);
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
          applyState(
            {
              ...body,
              version: Math.max(Date.now(), state.version + 1),
              sourceId: body.sourceId || clientId,
              updatedAt: Date.now(),
            },
            true
          );
        } catch {}
      }
      return response(state);
    }

    return nativeFetch(input, init);
  };

  function scheduleRemotePublish(nextState) {
    pendingPublishState = nextState;
    window.clearTimeout(pendingPublishTimer);
    pendingPublishTimer = window.setTimeout(() => {
      const payload = {
        type: "ss4-state",
        room,
        sender: clientId,
        state: pendingPublishState,
      };
      nativeFetch(relayBase, {
        method: "POST",
        body: JSON.stringify(payload),
        mode: "cors",
      })
        .then((res) => {
          if (!res.ok) throw new Error(`relay ${res.status}`);
          connected = true;
          lastSentAt = Date.now();
          setStatus("connected");
        })
        .catch(() => {
          setStatus(connected ? "degraded" : "offline");
        });
    }, 120);
  }

  function handleRelayEnvelope(envelope) {
    if (!envelope || envelope.event === "open" || envelope.event === "keepalive") {
      connected = true;
      setStatus("connected");
      return;
    }
    if (envelope.id) {
      if (seenRelayIds.has(envelope.id)) return;
      seenRelayIds.add(envelope.id);
      if (seenRelayIds.size > 200) {
        const first = seenRelayIds.values().next().value;
        seenRelayIds.delete(first);
      }
    }
    if (envelope.time) lastRelayTime = Math.max(lastRelayTime, envelope.time);

    let payload = null;
    try {
      payload =
        typeof envelope.message === "string"
          ? JSON.parse(envelope.message)
          : envelope.message;
    } catch {
      return;
    }
    if (
      !payload ||
      payload.type !== "ss4-state" ||
      payload.room !== room ||
      payload.sender === clientId
    ) {
      return;
    }
    lastReceivedAt = Date.now();
    applyState(payload.state, false);
  }

  function startEventSource() {
    try {
      const source = new EventSource(`${relayBase}/sse?since=all`);
      source.onopen = () => {
        connected = true;
        setStatus("connected");
      };
      source.onmessage = (event) => {
        try {
          handleRelayEnvelope(JSON.parse(event.data));
        } catch {}
      };
      source.onerror = () => {
        setStatus(connected ? "degraded" : "offline");
      };
    } catch {
      setStatus("offline");
    }
  }

  function startPollingFallback() {
    const poll = () => {
      const since = lastRelayTime > 0 ? Math.max(0, lastRelayTime - 1) : "all";
      nativeFetch(`${relayBase}/json?poll=1&since=${since}`, {
        cache: "no-store",
        mode: "cors",
      })
        .then((res) => (res.ok ? res.text() : ""))
        .then((text) => {
          if (!text) return;
          text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line) => {
              try {
                handleRelayEnvelope(JSON.parse(line));
              } catch {}
            });
        })
        .catch(() => {});
    };
    pollTimer = window.setInterval(poll, 2500);
    poll();
  }

  function ensureStatusBadge() {
    if (params.get("syncStatus") === "0") return null;
    let badge = document.getElementById("ss4-public-sync-status");
    if (badge) return badge;
    badge = document.createElement("div");
    badge.id = "ss4-public-sync-status";
    badge.style.cssText = [
      "position:fixed",
      "left:12px",
      "bottom:12px",
      "z-index:2147483647",
      "padding:7px 10px",
      "border-radius:8px",
      "font:12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "color:#d7faff",
      "background:rgba(3,23,34,.82)",
      "border:1px solid rgba(34,211,238,.35)",
      "box-shadow:0 8px 24px rgba(0,0,0,.3)",
      "pointer-events:none",
      "backdrop-filter:blur(8px)",
    ].join(";");
    document.body.appendChild(badge);
    updateStatusBadge();
    return badge;
  }

  function updateStatusBadge() {
    const badge = document.getElementById("ss4-public-sync-status");
    if (!badge) return;
    const status = window.__SS4_PUBLIC_SYNC__.status;
    const now = Date.now();
    const receivedLabel = lastReceivedAt
      ? `收 ${Math.max(0, Math.round((now - lastReceivedAt) / 1000))}s`
      : "未收";
    const sentLabel = lastSentAt
      ? `发 ${Math.max(0, Math.round((now - lastSentAt) / 1000))}s`
      : "未发";
    const label =
      status === "connected"
        ? "已连接"
        : status === "degraded"
          ? "连接不稳"
          : status === "offline"
            ? "未连接"
            : "连接中";
    badge.textContent = `公网同步 ${label} · room: ${room} · ${sentLabel} · ${receivedLabel}`;
  }

  window.setInterval(updateStatusBadge, 1000);

  window.addEventListener("beforeunload", () => {
    if (pollTimer) window.clearInterval(pollTimer);
  });

  persistState();
  startEventSource();
  startPollingFallback();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureStatusBadge, { once: true });
  } else {
    ensureStatusBadge();
  }
})();
