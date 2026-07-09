import { sendWebResponse, toWebRequest } from "./_node.js";
import { getDocument, json, publicDocument, verifyPassword } from "./_shared.js";

export default async function handler(req, res) {
  const response = await handleDocument(toWebRequest(req));
  await sendWebResponse(res, response);
}

async function handleDocument(request) {
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
    console.error(error);
    return json({ message: error.message || "Terjadi kesalahan." }, error.status || 500);
  }
}
