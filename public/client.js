const APP_CACHE = "manual-sakte-app-v3";
const PDF_CACHE = "manual-sakte-pdf-v3";
const RECENT_KEY = "manual-sakte-recent";
const ADMIN_SESSION_KEY = "manual-sakte-admin-password";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_UPLOAD_LABEL = "4 MB";

const lookupView = document.querySelector("#lookupView");
const viewerView = document.querySelector("#viewerView");
const adminView = document.querySelector("#adminView");
const documentForm = document.querySelector("#documentForm");
const documentCode = document.querySelector("#documentCode");
const documentTitle = document.querySelector("#documentTitle");
const pdfFrame = document.querySelector("#pdfFrame");
const notice = document.querySelector("#notice");
const openPdfLink = document.querySelector("#openPdfLink");
const networkStatus = document.querySelector("#networkStatus");
const recentDocuments = document.querySelector("#recentDocuments");
const recentList = document.querySelector("#recentList");
const adminForm = document.querySelector("#adminForm");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminLoginPassword = document.querySelector("#adminLoginPassword");
const adminLoginNotice = document.querySelector("#adminLoginNotice");
const adminDashboard = document.querySelector("#adminDashboard");
const adminPassword = document.querySelector("#adminPassword");
const pdfTitle = document.querySelector("#pdfTitle");
const pdfCode = document.querySelector("#pdfCode");
const pdfPassword = document.querySelector("#pdfPassword");
const pdfFile = document.querySelector("#pdfFile");
const generatePassword = document.querySelector("#generatePassword");
const newDocument = document.querySelector("#newDocument");
const adminLogout = document.querySelector("#adminLogout");
const cancelEdit = document.querySelector("#cancelEdit");
const saveDocument = document.querySelector("#saveDocument");
const editingCode = document.querySelector("#editingCode");
const generatedResult = document.querySelector("#generatedResult");
const generatedLink = document.querySelector("#generatedLink");
const generatedPassword = document.querySelector("#generatedPassword");
const copyGenerated = document.querySelector("#copyGenerated");
const downloadGeneratedBarcode = document.querySelector("#downloadGeneratedBarcode");
const adminNotice = document.querySelector("#adminNotice");
const adminTableBody = document.querySelector("#adminTableBody");
const adminEmptyState = document.querySelector("#adminEmptyState");
const adminLink = document.querySelector("#adminLink");
const passwordDialog = document.querySelector("#passwordDialog");
const passwordForm = document.querySelector("#passwordForm");
const documentPassword = document.querySelector("#documentPassword");
const passwordMessage = document.querySelector("#passwordMessage");

const normalizeCode = (value) =>
  value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

const currentCodeFromPath = () => {
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0] || "";
  if (firstSegment.toLowerCase() === "admin") {
    return "";
  }
  return normalizeCode(firstSegment);
};

const isAdminRoute = () => window.location.pathname.split("/").filter(Boolean)[0]?.toLowerCase() === "admin";
const pdfApiUrlFor = (code, credential) => {
  const params = new URLSearchParams({ code });
  if (credential?.token) {
    params.set("t", credential.token);
  } else {
    params.set("password", credential?.password || "");
  }
  return `/api/pdf?${params.toString()}`;
};
const cacheKeyFor = (code) => `/offline-pdf/${encodeURIComponent(code)}.pdf`;

function setStatus() {
  const online = navigator.onLine;
  networkStatus.textContent = online ? "Online" : "Offline";
  networkStatus.dataset.state = online ? "online" : "offline";
}

function hideAllViews() {
  lookupView.hidden = true;
  viewerView.hidden = true;
  adminView.hidden = true;
}

function setNotice(target, message, kind = "info") {
  target.textContent = message;
  target.dataset.kind = kind;
  target.hidden = !message;
}

function showLookup() {
  hideAllViews();
  lookupView.hidden = false;
  renderRecentDocuments();
}

function showViewer(code) {
  hideAllViews();
  viewerView.hidden = false;
  documentTitle.textContent = code;
  openPdfLink.removeAttribute("href");
}

function showAdmin() {
  hideAllViews();
  adminView.hidden = false;
  const savedPassword = sessionStorage.getItem(ADMIN_SESSION_KEY) || "";
  adminLoginPassword.value = savedPassword;
  adminPassword.value = savedPassword;
  if (savedPassword) {
    showAdminDashboard();
  } else {
    showAdminLogin();
  }
}

function showAdminLogin() {
  adminLoginForm.hidden = false;
  adminDashboard.hidden = true;
  setNotice(adminLoginNotice, "");
}

function showAdminDashboard() {
  adminLoginForm.hidden = true;
  adminDashboard.hidden = false;
  resetAdminForm();
  renderAdminList();
}

async function cachePdf(code, response) {
  const cache = await caches.open(PDF_CACHE);
  await cache.put(cacheKeyFor(code), response.clone());
  await cacheDocumentShell(code);
}

async function getCachedPdf(code) {
  const cache = await caches.open(PDF_CACHE);
  return cache.match(cacheKeyFor(code));
}

async function cacheDocumentShell(code) {
  const appCache = await caches.open(APP_CACHE);
  const shellResponse = await caches.match("/") || await fetch("/", { cache: "no-store" });
  await appCache.put("/", shellResponse.clone());
  await appCache.put(`/${encodeURIComponent(code)}`, shellResponse.clone());
}

async function waitForServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.ready;
  } catch {
    // Cache API still works when SW readiness is delayed.
  }
}

async function readCredentialFor(code) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("t") || params.get("token");
  if (token) {
    return { token };
  }

  const fromUrl = params.get("p") || params.get("password");
  if (fromUrl) {
    return { password: fromUrl };
  }

  const saved = sessionStorage.getItem(`doc-password:${code}`);
  if (saved) {
    return { password: saved };
  }

  passwordMessage.textContent = "";
  documentPassword.value = "";
  passwordDialog.showModal();

  return new Promise((resolve) => {
    passwordForm.onsubmit = (event) => {
      event.preventDefault();
      const value = documentPassword.value.trim();
      if (!value) {
        passwordMessage.textContent = "Password wajib diisi.";
        return;
      }
      passwordDialog.close();
      sessionStorage.setItem(`doc-password:${code}`, value);
      resolve({ password: value });
    };
  });
}

async function getPdfResponse(code, credential) {
  if (navigator.onLine) {
    try {
      const response = await fetch(pdfApiUrlFor(code, credential), { cache: "no-store" });
      if (!response.ok) {
        const payload = await readJsonSafely(response);
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }
      await cachePdf(code, response.clone());
      rememberDocument(code);
      return { response, source: "network" };
    } catch (error) {
      const cached = await getCachedPdf(code);
      if (cached) {
        return { response: cached, source: "cache-after-network-error" };
      }
      throw error;
    }
  }

  const cached = await getCachedPdf(code);
  if (cached) {
    return { response: cached, source: "cache" };
  }

  throw new Error("Dokumen belum tersedia di cache offline.");
}

async function renderPdf(code) {
  showViewer(code);
  setNotice(notice, "");
  pdfFrame.innerHTML = '<div class="loader">Menyiapkan PDF</div>';

  try {
    await waitForServiceWorker();
    const credential = await readCredentialFor(code);
    const metadata = navigator.onLine ? await getDocumentMetadata(code, credential) : null;
    if (metadata?.title) {
      documentTitle.textContent = metadata.title;
    }

    const { response, source } = await getPdfResponse(code, credential);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    pdfFrame.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.title = `PDF ${code}`;
    iframe.src = objectUrl;
    pdfFrame.append(iframe);
    openPdfLink.href = objectUrl;

    if (source === "network") {
      setNotice(notice, "PDF dibuka dari server dan sudah siap untuk akses offline di browser ini.", "success");
    } else {
      setNotice(notice, "PDF dibuka dari cache offline.", "success");
    }
  } catch (error) {
    pdfFrame.innerHTML = '<div class="loader">PDF tidak dapat ditampilkan</div>';
    setNotice(
      notice,
      navigator.onLine
        ? error.message || `PDF ${code} tidak ditemukan atau password salah.`
        : `PDF ${code} belum pernah dibuka online, sehingga belum ada versi offline.`,
      "error",
    );
  }
}

async function getDocumentMetadata(code, credential) {
  const params = new URLSearchParams({ code });
  if (credential?.token) {
    params.set("t", credential.token);
  } else {
    params.set("password", credential?.password || "");
  }
  const response = await fetch(`/api/document?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readJsonSafely(response);
    throw new Error(payload?.message || "Dokumen tidak dapat dibuka.");
  }
  return response.json();
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function rememberDocument(code) {
  const existing = readRecentDocuments().filter((item) => item !== code);
  const updated = [code, ...existing].slice(0, 12);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

function readRecentDocuments() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function renderRecentDocuments() {
  const items = readRecentDocuments();
  recentDocuments.hidden = items.length === 0;
  recentList.innerHTML = "";

  for (const code of items) {
    const link = document.createElement("a");
    link.href = `/${encodeURIComponent(code)}`;
    link.innerHTML = `<span>${code}</span><small>Offline siap</small>`;
    recentList.append(link);
  }
}

function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function renderAdminList() {
  const password = adminPassword.value.trim();
  adminTableBody.innerHTML = "";
  adminEmptyState.hidden = true;
  if (!password || !navigator.onLine) {
    return;
  }

  try {
    const response = await fetch(`/api/documents?adminPassword=${encodeURIComponent(password)}`, { cache: "no-store" });
    if (!response.ok) {
      const payload = await readJsonSafely(response);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      showAdminLogin();
      setNotice(adminLoginNotice, payload?.message || "Sesi admin tidak valid.", "error");
      return;
    }
    const documents = await response.json();
    adminEmptyState.hidden = documents.length > 0;
    for (const doc of documents) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${escapeHtml(doc.title)}</strong></td>
        <td>${escapeHtml(doc.code)}</td>
        <td>${formatDate(doc.createdAt)}</td>
        <td>
          <div class="table-actions">
            <button type="button" data-action="copy" data-code="${escapeHtml(doc.code)}">Salin</button>
            <button type="button" data-action="barcode" data-code="${escapeHtml(doc.code)}">Barcode</button>
            <button type="button" data-action="edit" data-code="${escapeHtml(doc.code)}" data-title="${escapeHtml(doc.title)}">Edit</button>
            <button type="button" data-action="delete" data-code="${escapeHtml(doc.code)}">Hapus</button>
          </div>
        </td>
      `;
      adminTableBody.append(row);
    }
  } catch (error) {
    setNotice(adminNotice, error.message || "Gagal memuat daftar dokumen.", "error");
  }
}

function resetAdminForm() {
  adminForm.hidden = true;
  generatedResult.hidden = true;
  editingCode.value = "";
  pdfCode.disabled = false;
  pdfTitle.value = "";
  pdfCode.value = "";
  pdfPassword.value = "";
  pdfFile.value = "";
  saveDocument.textContent = "Simpan";
  setNotice(adminNotice, "");
}

function openCreateForm() {
  adminForm.hidden = false;
  generatedResult.hidden = true;
  editingCode.value = "";
  pdfCode.disabled = false;
  pdfFile.required = true;
  saveDocument.textContent = "Upload & Buat Link";
  setNotice(adminNotice, "");
}

function openEditForm(code, title) {
  adminForm.hidden = false;
  generatedResult.hidden = true;
  editingCode.value = code;
  pdfCode.value = code;
  pdfCode.disabled = true;
  pdfTitle.value = title;
  pdfPassword.value = "";
  pdfFile.value = "";
  pdfFile.required = false;
  saveDocument.textContent = "Update Dokumen";
  setNotice(adminNotice, "Kosongkan password jika tidak ingin mengganti password dokumen.");
}

function documentUrl(code, password = "") {
  const url = new URL(`/${encodeURIComponent(code)}`, window.location.origin);
  if (password) {
    url.searchParams.set("p", password);
  }
  return url.toString();
}

function barcodeUrlForLink(link) {
  return `/api/barcode?url=${encodeURIComponent(link)}`;
}

function barcodeUrlForCode(code) {
  const params = new URLSearchParams({
    code,
    adminPassword: adminPassword.value.trim(),
  });
  return `/api/barcode?${params.toString()}`;
}

async function downloadBarcode(url, filename) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.includes("image/png")) {
    const payload = await readJsonSafely(response);
    throw new Error(payload?.message || "Barcode gagal dibuat.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isPdfTooLarge(file) {
  return file && file.size > MAX_UPLOAD_BYTES;
}

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 MB";
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

documentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = normalizeCode(documentCode.value);
  if (code) {
    window.location.assign(`/${encodeURIComponent(code)}`);
  }
});

generatePassword.addEventListener("click", () => {
  pdfPassword.value = randomPassword();
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = adminLoginPassword.value.trim();
  adminPassword.value = password;
  setNotice(adminLoginNotice, "Memeriksa password admin...");

  try {
    const response = await fetch(`/api/documents?adminPassword=${encodeURIComponent(password)}`, { cache: "no-store" });
    const payload = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error(payload?.message || "Password admin salah.");
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, password);
    showAdminDashboard();
  } catch (error) {
    setNotice(adminLoginNotice, error.message || "Login gagal.", "error");
  }
});

newDocument.addEventListener("click", openCreateForm);
cancelEdit.addEventListener("click", resetAdminForm);
adminLogout.addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  adminPassword.value = "";
  adminLoginPassword.value = "";
  showAdminLogin();
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const isEditing = Boolean(editingCode.value);
  setNotice(adminNotice, isEditing ? "Mengupdate dokumen..." : "Mengunggah PDF dan membuat link...");
  generatedResult.hidden = true;

  const file = pdfFile.files[0];
  const password = adminPassword.value.trim();
  const title = pdfTitle.value.trim();
  const code = isEditing ? editingCode.value : normalizeCode(pdfCode.value || title);
  const documentPasswordValue = pdfPassword.value.trim() || (isEditing ? "" : randomPassword());

  if (!isEditing && (!file || file.type !== "application/pdf")) {
    setNotice(adminNotice, "Pilih file PDF yang valid.", "error");
    return;
  }

  if (file && file.type !== "application/pdf") {
    setNotice(adminNotice, "File pengganti harus berformat PDF.", "error");
    return;
  }

  if (isPdfTooLarge(file)) {
    setNotice(adminNotice, `Ukuran PDF ${formatFileSize(file.size)}. Maksimal ${MAX_UPLOAD_LABEL}.`, "error");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("adminPassword", password);
    formData.append("title", title);
    formData.append("code", code);
    if (documentPasswordValue) {
      formData.append("documentPassword", documentPasswordValue);
    }
    if (file) {
      formData.append("pdf", file);
    }

    const response = await fetch("/api/documents", {
      method: isEditing ? "PUT" : "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || "Upload gagal.");
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, password);
    if (payload.url) {
      generatedLink.value = payload.url;
      generatedPassword.value = payload.password || "";
      generatedResult.hidden = false;
    }
    adminForm.hidden = true;
    editingCode.value = "";
    pdfCode.disabled = false;
    pdfTitle.value = "";
    pdfCode.value = "";
    pdfPassword.value = "";
    pdfFile.value = "";
    setNotice(adminNotice, isEditing ? "Dokumen berhasil diupdate." : "Dokumen berhasil dibuat.", "success");
    renderAdminList();
  } catch (error) {
    setNotice(adminNotice, error.message || "Simpan gagal.", "error");
  }
});

pdfFile.addEventListener("change", () => {
  const file = pdfFile.files[0];
  if (!file) {
    return;
  }

  if (file.type !== "application/pdf") {
    setNotice(adminNotice, "File harus berformat PDF.", "error");
    pdfFile.value = "";
    return;
  }

  if (isPdfTooLarge(file)) {
    setNotice(adminNotice, `Ukuran PDF ${formatFileSize(file.size)}. Maksimal ${MAX_UPLOAD_LABEL}.`, "error");
    pdfFile.value = "";
    return;
  }

  setNotice(adminNotice, `File siap diupload: ${file.name} (${formatFileSize(file.size)}).`, "success");
});

copyGenerated.addEventListener("click", async () => {
  const text = `Link: ${generatedLink.value}\nPassword: ${generatedPassword.value}`;
  await navigator.clipboard.writeText(text);
  copyGenerated.textContent = "Tersalin";
  setTimeout(() => {
    copyGenerated.textContent = "Salin";
  }, 1400);
});

downloadGeneratedBarcode.addEventListener("click", async () => {
  if (!generatedLink.value) {
    return;
  }
  try {
    downloadGeneratedBarcode.textContent = "Membuat...";
    await downloadBarcode(barcodeUrlForLink(generatedLink.value), "manual-sakte-barcode.png");
  } catch (error) {
    setNotice(adminNotice, error.message || "Barcode gagal dibuat.", "error");
  } finally {
    downloadGeneratedBarcode.textContent = "Download Barcode";
  }
});

adminTableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const { action, code, title } = button.dataset;
  if (action === "copy") {
    await navigator.clipboard.writeText(documentUrl(code));
    button.textContent = "Tersalin";
    setTimeout(() => {
      button.textContent = "Salin";
    }, 1400);
    return;
  }

  if (action === "barcode") {
    try {
      button.textContent = "Membuat...";
      await downloadBarcode(barcodeUrlForCode(code), `${code.toLowerCase()}-barcode.png`);
    } catch (error) {
      setNotice(adminNotice, error.message || "Barcode gagal dibuat.", "error");
    } finally {
      button.textContent = "Barcode";
    }
    return;
  }

  if (action === "edit") {
    openEditForm(code, title);
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm(`Hapus dokumen ${code}?`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/documents?adminPassword=${encodeURIComponent(adminPassword.value.trim())}&code=${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      const payload = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(payload?.message || "Hapus dokumen gagal.");
      }
      setNotice(adminNotice, "Dokumen berhasil dihapus.", "success");
      renderAdminList();
    } catch (error) {
      setNotice(adminNotice, error.message || "Hapus dokumen gagal.", "error");
    }
  }
});

window.addEventListener("online", setStatus);
window.addEventListener("offline", setStatus);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then((registration) => {
    registration.update();
  });
}

setStatus();

adminLink.href = "/admin";

const code = currentCodeFromPath();
if (isAdminRoute()) {
  showAdmin();
} else if (code) {
  renderPdf(code);
} else {
  showLookup();
}
