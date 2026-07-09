import { sendWebResponse, toWebRequest } from "./_node.js";
import { getDocument, json, verifyPassword } from "./_shared.js";

export default async function handler(req, res) {
  const response = await handlePdf(toWebRequest(req));
  await sendWebResponse(res, response);
}

async function handlePdf(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") || "";
    const password = url.searchParams.get("password") || "";
    const doc = await getDocument(code);

    if (!doc) {
      return json({ message: "Dokumen tidak ditemukan." }, 404);
    }

    if (!(await verifyPassword(password, doc.passwordHash))) {
      return json({ message: "Password dokumen salah." }, 401);
    }

    const response = await fetch(doc.pdfUrl, { cache: "no-store" });
    if (!response.ok) {
      return json({ message: "PDF tidak dapat dibaca dari storage." }, 502);
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}
