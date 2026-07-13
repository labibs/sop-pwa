import QRCode from "qrcode";
import { DOCUMENT_PREFIX, createAccessToken, getDocument, normalizeCode, putJson, requireAdmin } from "../../../lib/documents";

export const runtime = "nodejs";

export async function GET(request) {
  const url = new URL(request.url);
  const explicitUrl = url.searchParams.get("url");
  const code = url.searchParams.get("code");
  let target = explicitUrl;

  if (!target && code) {
    try {
      requireAdmin(url.searchParams.get("adminPassword") || "");
      const normalizedCode = normalizeCode(code);
      const doc = await ensureAccessToken(normalizedCode);
      target = absoluteUrl(request, `/${encodeURIComponent(normalizedCode)}?t=${encodeURIComponent(doc.accessToken)}`);
    } catch (error) {
      return Response.json({ message: error.message || "Barcode gagal dibuat." }, { status: error.status || 500 });
    }
  }

  if (!target) {
    return Response.json({ message: "Parameter url atau code wajib diisi." }, { status: 400 });
  }

  const svg = await QRCode.toString(target, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 1024,
    color: {
      dark: "#172426",
      light: "#ffffff",
    },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameFor(code || "manual-sakte")}-barcode.svg"`,
      "Cache-Control": "no-store",
    },
  });
}

async function ensureAccessToken(code) {
  const doc = await getDocument(code);
  if (!doc) {
    throw Object.assign(new Error("Dokumen tidak ditemukan."), { status: 404 });
  }

  if (doc.accessToken) {
    return doc;
  }

  const updated = {
    ...doc,
    accessToken: createAccessToken(),
    updatedAt: new Date().toISOString(),
  };
  await putJson(`${DOCUMENT_PREFIX}${code}.json`, updated);
  return updated;
}

function absoluteUrl(request, path) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}${path}`;
}

function filenameFor(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
