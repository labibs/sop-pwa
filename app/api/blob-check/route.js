import { list } from "@vercel/blob";
import { blobTokenDiagnostics, getBlobToken } from "../../../lib/documents";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await list({ prefix: "documents/", limit: 1, token: getBlobToken() });
    return Response.json({
      ok: true,
      blobToken: blobTokenDiagnostics(),
      count: result.blobs.length,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        ok: false,
        blobToken: blobTokenDiagnostics(),
        name: error.name,
        message: error.message,
      },
      { status: 500 },
    );
  }
}
