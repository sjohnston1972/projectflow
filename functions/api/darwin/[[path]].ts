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

const sha256 = async (value: string) =>
  toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

const verifyStudySessionSubject = async (
  token: string | null,
  secret: string,
  studyId: string,
  participantId: string,
) => {
  try {
    if (!token) return false;
    const [encodedClaims, signature, extra] = token.split(".");
    if (!encodedClaims || !signature || extra) return false;
    const expected = await hmac(secret, encodedClaims);
    const [suppliedDigest, expectedDigest] = await Promise.all([
      sha256(signature.toLowerCase()),
      sha256(expected),
    ]);
    if (suppliedDigest !== expectedDigest) return false;
    const padded = encodedClaims
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(encodedClaims.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as {
      studyId?: unknown;
      participantId?: unknown;
      expiresAt?: unknown;
    };
    return (
      claims.studyId === studyId &&
      claims.participantId === participantId &&
      typeof claims.expiresAt === "number" &&
      claims.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
};

const response = (status: number, error: string, message: string) =>
  Response.json(
    { error, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );

const routeAllowed = (method: string, path: string) => {
  if (method === "POST" && path === "study-sessions") return true;
  if (method === "POST" && path === "telemetry/events") return true;
  return (
    (method === "GET" || method === "PUT") &&
    /^studies\/[a-zA-Z0-9._:-]{1,128}\/participants\/[a-zA-Z0-9._:-]{1,128}\/workspace$/.test(
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
  const workspaceMatch = path.match(
    /^studies\/([a-zA-Z0-9._:-]{1,128})\/participants\/([a-zA-Z0-9._:-]{1,128})\/workspace$/,
  );

const readBoundedBody = async (request: Request, maximumBytes: number) => {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > maximumBytes) {
      throw new Error("payload_too_large");
    }
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel("request body limit exceeded").catch(() => undefined);
        throw new Error("payload_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
};
  if (
    workspaceMatch &&
    !(await verifyStudySessionSubject(
      request.headers.get("X-Darwin-Study-Session"),
      secret,
      workspaceMatch[1]!,
      workspaceMatch[2]!,
    ))
  ) {
    return response(
      403,
      "study_session_subject_mismatch",
      "The workspace path does not match the study session subject.",
    );
  }
  let body = "";
  try {
    body =
      request.method === "GET" ? "" : await readBoundedBody(request, 256_000);
  } catch {
    return response(413, "payload_too_large", "The request body is too large.");
  }

  const requestUrl = new URL(request.url);
  const sourceOrigin = requestUrl.origin;
  const clientAddress = request.headers.get("CF-Connecting-IP") || "unknown";
  const clientKey = await hmac(secret, `client\n${clientAddress}`);
  const timestamp = String(Date.now());
  const normalizedUpstreamPath = `/api/${path}`;
  const canonical = [
    request.method.toUpperCase(),
    normalizedUpstreamPath,
    timestamp,
    "projectflow",
    sourceOrigin,
    clientKey,
    await sha256(body),
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
      ...(request.headers.get("X-Darwin-Study-Session")
        ? {
            "X-Darwin-Study-Session": request.headers.get(
              "X-Darwin-Study-Session",
            )!,
          }
        : {}),
    },
    ...(body ? { body } : {}),
  });
  const upstreamContentType = upstream.headers.get("Content-Type") || "";
  if (!upstreamContentType.toLowerCase().includes("application/json")) {
    await upstream.body?.cancel().catch(() => undefined);
    return response(
      502,
      "invalid_upstream_response",
      "Darwin returned an unsupported response.",
    );
  }
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": upstreamContentType,
  });
  const retryAfter = upstream.headers.get("Retry-After");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return new Response(upstream.body, { status: upstream.status, headers });
};
