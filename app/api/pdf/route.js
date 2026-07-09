import { getDocument, json, verifyPassword } from "../../../lib/documents";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const doc = await getDocument(url.searchParams.get("code") || "");
    if (!doc) {
      return json({ message: "Dokumen tidak ditemukan." }, 404);
    }
    if (!verifyPassword(url.searchParams.get("password") || "", doc.passwordHash)) {
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
    console.error(error);
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}
