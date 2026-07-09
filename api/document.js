import { getDocument, json, publicDocument, verifyPassword } from "./_shared.js";

export const config = {
  runtime: "edge",
};

export default async function handler(request) {
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

    return json(publicDocument(doc));
  } catch (error) {
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}
