import { del, list, put } from "@vercel/blob";
import { sendWebResponse, toWebRequest } from "./_node.js";
import {
  DOCUMENT_PREFIX,
  PDF_PREFIX,
  absoluteUrl,
  createPasswordHash,
  json,
  normalizeCode,
  publicDocument,
  putJson,
  requireAdmin,
} from "./_shared.js";

export default async function handler(req, res) {
  const response = await handleDocuments(toWebRequest(req));
  await sendWebResponse(res, response);
}

async function handleDocuments(request) {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      requireAdmin(url.searchParams.get("adminPassword") || "");
      const result = await list({ prefix: DOCUMENT_PREFIX, limit: 1000 });
      const documents = await Promise.all(
        result.blobs.map(async (blob) => {
          const response = await fetch(blob.url, { cache: "no-store" });
          return response.ok ? publicDocument(await response.json()) : null;
        }),
      );
      return json(documents.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      requireAdmin(url.searchParams.get("adminPassword") || "");
      const code = normalizeCode(url.searchParams.get("code") || "");
      if (!code) {
        return json({ message: "Kode dokumen wajib diisi." }, 400);
      }

      const existing = await readDocumentForAdmin(code);
      if (!existing) {
        return json({ message: "Dokumen tidak ditemukan." }, 404);
      }

      await del([existing.pdfPathname, `${DOCUMENT_PREFIX}${code}.json`]);
      return json({ message: "Dokumen berhasil dihapus." });
    }

    if (!["POST", "PUT"].includes(request.method)) {
      return json({ message: "Method tidak didukung." }, 405);
    }

    const formData = await request.formData();
    requireAdmin(formData.get("adminPassword"));

    const isUpdate = request.method === "PUT";
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

    const hasFile = file instanceof File && file.size > 0;
    if (!isUpdate && !hasFile) {
      return json({ message: "File PDF wajib diisi." }, 400);
    }

    if (hasFile && file.type !== "application/pdf") {
      return json({ message: "File harus berformat PDF." }, 400);
    }

    const now = new Date().toISOString();
    const existing = isUpdate ? await readDocumentForAdmin(code) : null;
    if (isUpdate && !existing) {
      return json({ message: "Dokumen tidak ditemukan." }, 404);
    }

    let pdfUrl = existing?.pdfUrl || "";
    let pdfPathname = existing?.pdfPathname || "";

    if (hasFile) {
      const safeFilename = String(file.name || `${code}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "-");
      pdfPathname = `${PDF_PREFIX}${code}-${globalThis.crypto.randomUUID()}-${safeFilename}`;
      const pdfBlob = await put(pdfPathname, file, {
        access: "public",
        contentType: "application/pdf",
      });
      pdfUrl = pdfBlob.url;
      pdfPathname = pdfBlob.pathname;

      if (existing?.pdfPathname) {
        await del(existing.pdfPathname);
      }
    }

    const doc = {
      code,
      title,
      pdfUrl,
      pdfPathname,
      passwordHash: documentPassword ? await createPasswordHash(documentPassword) : existing.passwordHash,
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
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}

async function readDocumentForAdmin(code) {
  const pathname = `${DOCUMENT_PREFIX}${normalizeCode(code)}.json`;
  const result = await list({ prefix: pathname, limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === pathname);
  if (!blob) {
    return null;
  }

  const response = await fetch(blob.url, { cache: "no-store" });
  return response.ok ? response.json() : null;
}
