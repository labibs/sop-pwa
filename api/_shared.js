import { list, put } from "@vercel/blob";

export const DOCUMENT_PREFIX = "documents/";
export const PDF_PREFIX = "manual-pdfs/";

export function json(response, status = 200) {
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
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

const encoder = new TextEncoder();

export function randomHex(bytes = 16) {
  const values = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function createPasswordHash(password, salt = randomHex()) {
  const source = encoder.encode(`${salt}:${String(password)}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", source);
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, passwordHash) {
  const [salt, expected] = String(passwordHash || "").split(":");
  if (!salt || !expected) {
    return false;
  }

  const actual = (await createPasswordHash(password, salt)).split(":")[1];
  return actual === expected;
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
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw Object.assign(
      new Error("BLOB_READ_WRITE_TOKEN belum diset. Connect Vercel Blob ke project, lalu redeploy."),
      { status: 500 },
    );
  }
}

export async function putJson(pathname, value) {
  requireBlobToken();
  return put(pathname, JSON.stringify(value, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
  });
}

export async function getDocument(code) {
  requireBlobToken();
  const pathname = `${DOCUMENT_PREFIX}${normalizeCode(code)}.json`;
  const result = await list({ prefix: pathname, limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === pathname);
  if (!blob) {
    return null;
  }

  const response = await fetch(blob.url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export function publicDocument(doc) {
  return {
    code: doc.code,
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function absoluteUrl(request, path) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}${path}`;
}
