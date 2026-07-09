import { getDocument, json, publicDocument, verifyPassword } from "../../../lib/documents";

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
    return json(publicDocument(doc));
  } catch (error) {
    console.error(error);
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}
