import { blobTokenDiagnostics } from "../../../lib/documents";

export const runtime = "nodejs";

export function GET() {
  return Response.json({
    ok: true,
    adminPassword: Boolean(process.env.ADMIN_PASSWORD),
    blobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    blobTokenDiagnostics: blobTokenDiagnostics(),
    node: process.version,
  });
}
