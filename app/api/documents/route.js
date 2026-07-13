import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import {
  DOCUMENT_PREFIX,
  PDF_PREFIX,
  absoluteUrl,
  createPasswordHash,
  deleteDocument,
  getDocument,
  json,
  listDocuments,
  normalizeCode,
  publicDocument,
  putJson,
  getBlobToken,
  requireAdmin,
  requireBlobToken,
} from "../../../lib/documents";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_LABEL = "20 MB";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    requireAdmin(url.searchParams.get("adminPassword") || "");
    return json(await listDocuments());
  } catch (error) {
    console.error(error);
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    requireAdmin(url.searchParams.get("adminPassword") || "");
    requireBlobToken();
    const code = normalizeCode(url.searchParams.get("code") || "");
    if (!code) {
      return json({ message: "Kode dokumen wajib diisi." }, 400);
    }
    await deleteDocument(code);
    return json({ message: "Dokumen berhasil dihapus." });
  } catch (error) {
    console.error(error);
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}

export async function POST(request) {
  return saveDocument(request, false);
}

export async function PUT(request) {
  return saveDocument(request, true);
}

async function saveDocument(request, isUpdate) {
  try {
    const formData = await request.formData();
    requireAdmin(formData.get("adminPassword"));
    requireBlobToken();

    const code = normalizeCode(formData.get("code") || formData.get("title"));
    const title = String(formData.get("title") || "").trim();
    const documentPassword = String(formData.get("documentPassword") || "").trim();
    const file = formData.get("pdf");

    if (!code || !title) {
      return json({ message: "Judul dan kode dokumen wajib diisi." }, 400);
    }
    if (!isUpdate && !documentPassword) {
      return json({ message: "Password dokumen wajib diisi." }, 400);
    }

    const existing = isUpdate ? await getDocument(code) : null;
    if (isUpdate && !existing) {
      return json({ message: "Dokumen tidak ditemukan." }, 404);
    }

    const hasFile = file instanceof File && file.size > 0;
    if (!isUpdate && !hasFile) {
      return json({ message: "File PDF wajib diisi." }, 400);
    }
    if (hasFile && file.type !== "application/pdf") {
      return json({ message: "File harus berformat PDF." }, 400);
    }
    if (hasFile && file.size > MAX_UPLOAD_BYTES) {
      return json({ message: `Ukuran PDF maksimal ${MAX_UPLOAD_LABEL}.` }, 413);
    }

    const now = new Date().toISOString();
    let pdfUrl = existing?.pdfUrl || "";
    let pdfPathname = existing?.pdfPathname || "";

    if (hasFile) {
      const safeFilename = String(file.name || `${code}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "-");
      const targetPathname = `${PDF_PREFIX}${code}-${crypto.randomUUID()}-${safeFilename}`;
      const pdfBlob = await put(targetPathname, file, {
        access: "private",
        contentType: "application/pdf",
        token: getBlobToken(),
      });
      pdfUrl = pdfBlob.url;
      pdfPathname = pdfBlob.pathname;

      if (existing?.pdfPathname) {
        await del(existing.pdfPathname, { token: getBlobToken() });
      }
    }

    const doc = {
      code,
      title,
      pdfUrl,
      pdfPathname,
      passwordHash: documentPassword ? createPasswordHash(documentPassword) : existing.passwordHash,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await putJson(`${DOCUMENT_PREFIX}${code}.json`, doc);

    return json({
      ...publicDocument(doc),
      url: documentPassword
        ? absoluteUrl(request, `/${encodeURIComponent(code)}?p=${encodeURIComponent(documentPassword)}`)
        : absoluteUrl(request, `/${encodeURIComponent(code)}`),
      password: documentPassword,
    }, isUpdate ? 200 : 201);
  } catch (error) {
    console.error(error);
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}
