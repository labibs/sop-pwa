import { sendWebResponse } from "./_node.js";
import { json } from "./_shared.js";

export default async function handler(_req, res) {
  await sendWebResponse(
    res,
    json({
      ok: true,
      adminPassword: Boolean(process.env.ADMIN_PASSWORD),
      blobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    }),
  );
}
