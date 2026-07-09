import Script from "next/script";

export default function Shell() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Manual SAKTE">
          <span className="brand-mark">S</span>
          <span>
            <strong>Manual SAKTE</strong>
            <small>Dokumen SOP offline-ready</small>
          </span>
        </a>
        <nav className="top-actions" aria-label="Navigasi">
          <a href="/admin" id="adminLink">Admin</a>
          <div className="status" id="networkStatus" data-state="checking">Memeriksa koneksi</div>
        </nav>
      </header>

      <main className="shell">
        <section className="lookup" id="lookupView">
          <div className="lookup-copy">
            <p className="eyebrow">PWA pembaca QR</p>
            <h1>Buka SOP dari URL QR dan simpan untuk akses offline.</h1>
            <p className="lead">
              Gunakan URL seperti <code>https://manual.sakte.id/BOR-001</code>. Saat online PDF dibuka
              langsung. Setelah tersimpan di cache, dokumen yang sama dapat dibuka otomatis ketika offline.
            </p>
          </div>

          <form className="search" id="documentForm">
            <label htmlFor="documentCode">Kode dokumen</label>
            <div className="search-row">
              <input id="documentCode" name="documentCode" type="text" autoComplete="off" inputMode="latin" placeholder="BOR-001" />
              <button type="submit">Buka</button>
            </div>
          </form>

          <div className="recent" id="recentDocuments" hidden>
            <h2>Dokumen tersimpan</h2>
            <div className="recent-list" id="recentList" />
          </div>
        </section>

        <section className="viewer" id="viewerView" hidden>
          <div className="viewer-toolbar">
            <div>
              <p className="eyebrow">Dokumen</p>
              <h1 id="documentTitle">Memuat dokumen</h1>
            </div>
            <div className="viewer-actions">
              <a className="ghost-button" href="/" id="homeLink">Daftar</a>
              <a className="primary-button" href="#" id="openPdfLink" target="_blank" rel="noreferrer">Buka PDF</a>
            </div>
          </div>

          <div className="notice" id="notice" hidden />
          <div className="pdf-frame" id="pdfFrame">
            <div className="loader" id="loader">Menyiapkan PDF</div>
          </div>
        </section>

        <section className="admin" id="adminView" hidden>
          <div className="admin-heading">
            <p className="eyebrow">Admin dokumen</p>
            <h1>Kelola dokumen PDF dan link QR.</h1>
          </div>

          <form className="admin-login" id="adminLoginForm">
            <label htmlFor="adminLoginPassword">Password admin</label>
            <div className="search-row">
              <input id="adminLoginPassword" name="adminLoginPassword" type="password" autoComplete="current-password" required />
              <button type="submit">Login</button>
            </div>
            <div className="notice" id="adminLoginNotice" hidden />
          </form>

          <div className="admin-dashboard" id="adminDashboard" hidden>
            <div className="admin-toolbar">
              <div>
                <h2>Daftar PDF</h2>
                <p>Upload, edit, hapus, dan salin link dokumen.</p>
              </div>
              <div className="viewer-actions">
                <button type="button" className="ghost-button" id="newDocument">Tambah PDF</button>
                <button type="button" className="ghost-button" id="adminLogout">Logout</button>
              </div>
            </div>

            <form className="admin-form" id="adminForm" hidden>
              <input id="adminPassword" name="adminPassword" type="hidden" />

              <label htmlFor="pdfTitle">Judul dokumen</label>
              <input id="pdfTitle" name="pdfTitle" type="text" autoComplete="off" placeholder="Boarding Manual BOR 001" required />

              <label htmlFor="pdfCode">Kode link</label>
              <input id="pdfCode" name="pdfCode" type="text" autoComplete="off" placeholder="BOR-001" />

              <label htmlFor="pdfPassword">Password dokumen</label>
              <div className="search-row">
                <input id="pdfPassword" name="pdfPassword" type="text" autoComplete="off" placeholder="Otomatis jika kosong" />
                <button type="button" id="generatePassword">Generate</button>
              </div>

              <label htmlFor="pdfFile">File PDF</label>
              <input id="pdfFile" name="pdfFile" type="file" accept="application/pdf" />

              <div className="viewer-actions">
                <button type="submit" id="saveDocument">Simpan</button>
                <button type="button" className="ghost-button" id="cancelEdit">Batal</button>
              </div>
              <input id="editingCode" type="hidden" />
            </form>
            <div className="notice" id="adminNotice" hidden />

            <div className="admin-panel">
              <div className="generated" id="generatedResult" hidden>
                <h2>Link siap dipakai</h2>
                <label htmlFor="generatedLink">Link</label>
                <input id="generatedLink" type="text" readOnly />
                <label htmlFor="generatedPassword">Password</label>
                <input id="generatedPassword" type="text" readOnly />
                <button type="button" id="copyGenerated">Salin</button>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Judul</th>
                      <th>Kode</th>
                      <th>Dibuat</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody id="adminTableBody" />
                </table>
                <div className="empty-state" id="adminEmptyState" hidden>Belum ada PDF yang diupload.</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <dialog className="password-dialog" id="passwordDialog">
        <form id="passwordForm" method="dialog">
          <h2>Password dokumen</h2>
          <p>Masukkan password untuk membuka PDF ini.</p>
          <input id="documentPassword" type="password" autoComplete="current-password" required />
          <p className="form-error" id="passwordMessage" />
          <button type="submit">Buka Dokumen</button>
        </form>
      </dialog>

      <Script src="/client.js" strategy="afterInteractive" />
    </>
  );
}
