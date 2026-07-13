import crypto from "node:crypto";
import { del, get, list, put } from "@vercel/blob";

export const DOCUMENT_PREFIX = "documents/";
export const PDF_PREFIX = "manual-pdfs/";

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

export function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.createHash("sha256").update(`${salt}:${String(password)}`).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [salt, expected] = String(passwordHash || "").split(":");
  if (!salt || !expected) {
    return false;
  }
  return createPasswordHash(password, salt).split(":")[1] === expected;
}

export function createAccessToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function verifyAccessToken(token, doc) {
  return Boolean(token && doc?.accessToken && token === doc.accessToken);
}

export function requireAdmin(password) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    throw Object.assign(new Error("ADMIN_PASSWORD belum diset di Vercel Environment Variables."), { status: 500 });
  }
  if (password !== configured) {
    throw Object.assign(new Error("Password admin salah."), { status: 401 });
  }
}

export function requireBlobToken() {
  if (!getBlobToken()) {
    throw Object.assign(
      new Error("BLOB_READ_WRITE_TOKEN belum diset. Connect Vercel Blob ke project, lalu redeploy."),
      { status: 500 },
    );
  }
}

export function getBlobToken() {
  return normalizeEnvToken(process.env.BLOB_READ_WRITE_TOKEN || "");
}

export function normalizeEnvToken(value) {
  return String(value || "")
    .trim()
    .replace(/^BLOB_READ_WRITE_TOKEN=/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

export function blobTokenDiagnostics() {
  const raw = String(process.env.BLOB_READ_WRITE_TOKEN || "");
  const normalized = getBlobToken();
  return {
    exists: raw.length > 0,
    rawLength: raw.length,
    normalizedLength: normalized.length,
    startsWithExpectedPrefix: normalized.startsWith("vercel_blob_rw_"),
    includesEnvKeyPrefix: raw.trim().startsWith("BLOB_READ_WRITE_TOKEN="),
    hasWrappingQuotes: /^["'].*["']$/.test(raw.trim()),
    hasWhitespaceAround: raw !== raw.trim(),
    looksMasked: normalized.includes("*"),
    preview: normalized ? `${normalized.slice(0, 14)}...${normalized.slice(-4)}` : "",
  };
}

export async function putJson(pathname, value) {
  requireBlobToken();
  return put(pathname, JSON.stringify(value, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    token: getBlobToken(),
  });
}

export async function getDocument(code) {
  requireBlobToken();
  const pathname = `${DOCUMENT_PREFIX}${normalizeCode(code)}.json`;
  const result = await list({ prefix: pathname, limit: 1, token: getBlobToken() });
  const blob = result.blobs.find((item) => item.pathname === pathname);
  if (!blob) {
    return null;
  }

  return readJsonBlob(blob.pathname);
}

export function publicDocument(doc) {
  return {
    code: doc.code,
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function adminDocument(doc, request) {
  return {
    ...publicDocument(doc),
    url: doc.accessToken
      ? absoluteUrl(request, `/${encodeURIComponent(doc.code)}?t=${encodeURIComponent(doc.accessToken)}`)
      : absoluteUrl(request, `/${encodeURIComponent(doc.code)}`),
  };
}

export function absoluteUrl(request, path) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}${path}`;
}

export async function listDocuments() {
  requireBlobToken();
  const result = await list({ prefix: DOCUMENT_PREFIX, limit: 1000, token: getBlobToken() });
  const documents = await Promise.all(
    result.blobs.map(async (blob) => readJsonBlob(blob.pathname)),
  );
  return documents.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteDocument(code) {
  const normalizedCode = normalizeCode(code);
  const existing = await getDocument(normalizedCode);
  if (!existing) {
    throw Object.assign(new Error("Dokumen tidak ditemukan."), { status: 404 });
  }

  await del([existing.pdfPathname, `${DOCUMENT_PREFIX}${normalizedCode}.json`], { token: getBlobToken() });
}

export async function getPrivateBlob(pathname) {
  requireBlobToken();
  return get(pathname, {
    access: "private",
    token: getBlobToken(),
    useCache: false,
  });
}

async function readJsonBlob(pathname) {
  const result = await getPrivateBlob(pathname);
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const response = new Response(result.stream);
  return response.json();
}
