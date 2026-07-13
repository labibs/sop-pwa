import { getDocument, json, publicDocument, verifyAccessToken, verifyPassword } from "../../../lib/documents";

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
    return json(publicDocument(doc));
  } catch (error) {
    console.error(error);
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}
