import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import crypto from "node:crypto";

const root = process.cwd();
const port = Number(process.env.PORT || 8080);
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const dataRoot = join(root, ".local-data");
const documentRoot = join(dataRoot, "documents");
const pdfRoot = join(dataRoot, "pdfs");

mkdirSync(documentRoot, { recursive: true });
mkdirSync(pdfRoot, { recursive: true });

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.createHash("sha256").update(`${salt}:${String(password)}`).digest("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, expected] = String(passwordHash || "").split(":");
  if (!salt || !expected) {
    return false;
  }
  return createPasswordHash(password, salt).split(":")[1] === expected;
}

function json(response, status = 200) {
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function requireAdmin(password) {
  if (password !== adminPassword) {
    return json({ message: "Password admin salah." }, 401);
  }
  return null;
}

function documentPath(code) {
  return join(documentRoot, `${normalizeCode(code)}.json`);
}

function pdfPath(code) {
  return join(pdfRoot, `${normalizeCode(code)}.pdf`);
}

function readDocument(code) {
  const path = documentPath(code);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeDocument(doc) {
  writeFileSync(documentPath(doc.code), JSON.stringify(doc, null, 2));
}

function publicDocument(doc) {
  return {
    code: doc.code,
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function absoluteUrl(request, path) {
  const host = request.headers.get("host") || `localhost:${port}`;
  return `http://${host}${path}`;
}

function filePathFor(urlPath) {
  const cleanPath = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = join(root, cleanPath);

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isDirectory()) {
    const indexPath = join(requestedPath, "index.html");
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }

  if (urlPath.startsWith("/pdf/")) {
    return null;
  }

  return join(root, "index.html");
}

async function toWebRequest(request) {
  const origin = `http://${request.headers.host || `localhost:${port}`}`;
  return new Request(new URL(request.url || "/", origin), {
    method: request.method,
    headers: request.headers,
    body: ["GET", "HEAD"].includes(request.method || "") ? undefined : Readable.toWeb(request),
    duplex: "half",
  });
}

async function handleApi(webRequest) {
  const url = new URL(webRequest.url);

  if (url.pathname === "/api/documents") {
    if (webRequest.method === "GET") {
      const denied = requireAdmin(url.searchParams.get("adminPassword") || "");
      if (denied) {
        return denied;
      }

      const files = existsSync(documentRoot) ? readdirSync(documentRoot).filter((file) => file.endsWith(".json")) : [];
      const documents = files
        .map((file) => JSON.parse(readFileSync(join(documentRoot, file), "utf8")))
        .map(publicDocument)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json(documents);
    }

    if (webRequest.method === "DELETE") {
      const denied = requireAdmin(url.searchParams.get("adminPassword") || "");
      if (denied) {
        return denied;
      }

      const code = normalizeCode(url.searchParams.get("code") || "");
      const doc = readDocument(code);
      if (!doc) {
        return json({ message: "Dokumen tidak ditemukan." }, 404);
      }

      rmSync(documentPath(code), { force: true });
      rmSync(pdfPath(code), { force: true });
      return json({ message: "Dokumen berhasil dihapus." });
    }

    if (webRequest.method === "POST" || webRequest.method === "PUT") {
      const formData = await webRequest.formData();
      const denied = requireAdmin(String(formData.get("adminPassword") || ""));
      if (denied) {
        return denied;
      }

      const isUpdate = webRequest.method === "PUT";
      const code = normalizeCode(formData.get("code") || formData.get("title"));
      const title = String(formData.get("title") || "").trim();
      const documentPassword = String(formData.get("documentPassword") || "").trim();
      const file = formData.get("pdf");
      const existing = isUpdate ? readDocument(code) : null;

      if (!code || !title) {
        return json({ message: "Judul dan kode dokumen wajib diisi." }, 400);
      }
      if (isUpdate && !existing) {
        return json({ message: "Dokumen tidak ditemukan." }, 404);
      }
      if (!isUpdate && !documentPassword) {
        return json({ message: "Password dokumen wajib diisi." }, 400);
      }

      const hasFile = file instanceof File && file.size > 0;
      if (!isUpdate && !hasFile) {
        return json({ message: "File PDF wajib diisi." }, 400);
      }
      if (hasFile && file.type !== "application/pdf") {
        return json({ message: "File harus berformat PDF." }, 400);
      }
      if (hasFile) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        writeFileSync(pdfPath(code), bytes);
      }

      const now = new Date().toISOString();
      const doc = {
        code,
        title,
        pdfUrl: `/api/pdf?code=${encodeURIComponent(code)}`,
        pdfPathname: pdfPath(code),
        passwordHash: documentPassword ? createPasswordHash(documentPassword) : existing.passwordHash,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      writeDocument(doc);
      return json({
        ...publicDocument(doc),
        url: documentPassword
          ? absoluteUrl(webRequest, `/${encodeURIComponent(code)}?p=${encodeURIComponent(documentPassword)}`)
          : absoluteUrl(webRequest, `/${encodeURIComponent(code)}`),
        password: documentPassword,
      }, isUpdate ? 200 : 201);
    }
  }

  if (url.pathname === "/api/document") {
    const doc = readDocument(url.searchParams.get("code") || "");
    if (!doc) {
      return json({ message: "Dokumen tidak ditemukan." }, 404);
    }
    if (!verifyPassword(url.searchParams.get("password") || "", doc.passwordHash)) {
      return json({ message: "Password dokumen salah." }, 401);
    }
    return json(publicDocument(doc));
  }

  if (url.pathname === "/api/pdf") {
    const doc = readDocument(url.searchParams.get("code") || "");
    if (!doc) {
      return json({ message: "Dokumen tidak ditemukan." }, 404);
    }
    if (!verifyPassword(url.searchParams.get("password") || "", doc.passwordHash)) {
      return json({ message: "Password dokumen salah." }, 401);
    }

    const path = pdfPath(doc.code);
    if (!existsSync(path)) {
      return json({ message: "PDF tidak ditemukan." }, 404);
    }
    return new Response(readFileSync(path), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return json({ message: "API tidak ditemukan." }, 404);
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `localhost:${port}`}`);

  if (url.pathname.startsWith("/api/")) {
    const apiResponse = await handleApi(await toWebRequest(request));
    response.writeHead(apiResponse.status, Object.fromEntries(apiResponse.headers.entries()));
    if (apiResponse.body) {
      Readable.fromWeb(apiResponse.body).pipe(response);
    } else {
      response.end();
    }
    return;
  }

  const path = filePathFor(url.pathname);

  if (!path || !existsSync(path)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": types[extname(path)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(path).pipe(response);
}).listen(port, () => {
  console.log(`Manual SAKTE PWA running at http://localhost:${port}`);
  console.log(`Local admin password: ${adminPassword}`);
});
