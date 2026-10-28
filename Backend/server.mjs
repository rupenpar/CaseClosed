import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const backendDirectory = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = join(backendDirectory, ".env");

  try {
    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      const separatorIndex = trimmedLine.indexOf("=");
      if (separatorIndex === -1) continue;

      const name = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, "$2");

      if (name && process.env[name] === undefined) {
        process.env[name] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

loadEnvFile();

const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const maxBodySize = 64 * 1024;
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 30;
const requestCounts = new Map();

if (!geminiApiKey) {
  throw new Error("GEMINI_API_KEY is required in Backend/.env");
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function isAllowedOrigin(origin) {
  return !origin || origin === frontendOrigin;
}

function isRateLimited(ipAddress) {
  const now = Date.now();
  const current = requestCounts.get(ipAddress);

  if (!current || now - current.startedAt >= rateLimitWindowMs) {
    requestCounts.set(ipAddress, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  return current.count > maxRequestsPerWindow;
}

function isValidGeminiRequest(body) {
  return (
    body &&
    typeof body === "object" &&
    Array.isArray(body.contents) &&
    body.contents.length > 0 &&
    body.contents.every(
      (content) =>
        content &&
        typeof content === "object" &&
        Array.isArray(content.parts) &&
        content.parts.length > 0 &&
        content.parts.every(
          (part) => part && typeof part.text === "string" && part.text.length > 0,
        ),
    )
  );
}

async function readRequestBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > maxBodySize) {
      throw new Error("Request body is too large.");
    }
  }

  return JSON.parse(body);
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;

  if (!isAllowedOrigin(origin)) {
    sendJson(response, 403, { error: "Origin is not allowed." });
    return;
  }

  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
    response.setHeader("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/gemini") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const ipAddress = request.socket.remoteAddress ?? "unknown";
  if (isRateLimited(ipAddress)) {
    sendJson(response, 429, { error: "Too many requests. Please try again later." });
    return;
  }

  try {
    const body = await readRequestBody(request);
    if (!isValidGeminiRequest(body)) {
      sendJson(response, 400, { error: "Invalid Gemini request payload." });
      return;
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const responseText = await geminiResponse.text();
    response.writeHead(geminiResponse.status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(responseText);
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be valid JSON." });
      return;
    }

    if (error instanceof Error && error.message === "Request body is too large.") {
      sendJson(response, 413, { error: error.message });
      return;
    }

    console.error("Gemini proxy request failed:", error);
    sendJson(response, 502, { error: "Unable to reach the Gemini service." });
  }
});

server.listen(port, () => {
  console.log(`Gemini proxy listening on http://localhost:${port}`);
});
