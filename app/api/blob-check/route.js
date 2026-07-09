import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await list({ prefix: "documents/", limit: 1 });
    return Response.json({
      ok: true,
      blobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      count: result.blobs.length,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        ok: false,
        blobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        name: error.name,
        message: error.message,
      },
      { status: 500 },
    );
  }
}
