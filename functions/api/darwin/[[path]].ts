interface GatewayEnvironment {
  DARWIN_API_BASE_URL?: string;
  PROJECTFLOW_INGESTION_SECRET?: string;
}

interface GatewayContext {
  request: Request;
  env: GatewayEnvironment;
  params: { path?: string | string[] };
}

const encoder = new TextEncoder();

const toHex = (value: ArrayBuffer) =>
  [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const hmac = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
};

const response = (status: number, error: string, message: string) =>
  Response.json(
    { error, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );

const routeAllowed = (method: string, path: string) => {
  if (method === "POST" && path === "telemetry/events") return true;
  return (
    (method === "GET" || method === "PUT") &&
    /^studies\/(?:projectflow-baseline-study|projectflow-baseline-automated-study)\/participants\/[a-zA-Z0-9_-]{1,128}\/workspace$/.test(
      path,
    )
  );
};

export const onRequest = async ({ request, env, params }: GatewayContext) => {
  const path = Array.isArray(params.path)
    ? params.path.join("/")
    : (params.path ?? "");
  if (!routeAllowed(request.method, path)) {
    return response(
      404,
      "not_found",
      "This target gateway route is not exposed.",
    );
  }

  const secret = env.PROJECTFLOW_INGESTION_SECRET?.trim();
  if (!secret) {
    return response(
      503,
      "gateway_unavailable",
      "ProjectFlow telemetry authentication is not configured.",
    );
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 256_000) {
    return response(413, "payload_too_large", "The request body is too large.");
  }
  const body = request.method === "GET" ? "" : await request.text();
  if (encoder.encode(body).byteLength > 256_000) {
    return response(413, "payload_too_large", "The request body is too large.");
  }

  const requestUrl = new URL(request.url);
  const sourceOrigin = requestUrl.origin;
  const clientAddress = request.headers.get("CF-Connecting-IP") || "unknown";
  const clientKey = await hmac(secret, `client\n${clientAddress}`);
  const timestamp = String(Date.now());
  const canonical = [
    timestamp,
    "projectflow",
    sourceOrigin,
    clientKey,
    body,
  ].join("\n");
  const signature = await hmac(secret, canonical);
  const apiBaseUrl = (
    env.DARWIN_API_BASE_URL || "https://darwin-api.stevie-johnston.workers.dev"
  ).replace(/\/$/, "");
  const upstreamUrl = `${apiBaseUrl}/api/${path}${requestUrl.search}`;

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-Darwin-Timestamp": timestamp,
      "X-Darwin-Target": "projectflow",
      "X-Darwin-Source-Origin": sourceOrigin,
      "X-Darwin-Client-Key": clientKey,
      "X-Darwin-Signature": signature,
    },
    ...(body ? { body } : {}),
  });
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type":
      upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
  });
  const retryAfter = upstream.headers.get("Retry-After");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return new Response(upstream.body, { status: upstream.status, headers });
};
