import { getDocument, getPrivateBlob, json, verifyAccessToken, verifyPassword } from "../../../lib/documents";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const doc = await getDocument(url.searchParams.get("code") || "");
    if (!doc) {
      return json({ message: "Dokumen tidak ditemukan." }, 404);
    }
    const token = url.searchParams.get("token") || url.searchParams.get("t") || "";
    const password = url.searchParams.get("password") || "";
    if ((token || password) && !verifyAccessToken(token, doc) && !verifyPassword(password, doc.passwordHash)) {
      return json({ message: "Link dokumen tidak valid. Gunakan QR terbaru dari admin." }, 401);
    }

    const result = await getPrivateBlob(doc.pdfPathname);
    if (!result || result.statusCode !== 200 || !result.stream) {
      return json({ message: "PDF tidak dapat dibaca dari storage." }, 502);
    }

    return new Response(result.stream, {
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
