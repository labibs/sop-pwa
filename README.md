# Manual SAKTE PWA

PWA untuk membuka PDF SOP dari QR URL seperti:

```text
https://manual.sakte.id/BOR-001?p=PASSWORD
```

Alur aplikasi:

1. Admin upload PDF dari halaman `/admin`.
2. Admin mengisi judul, kode dokumen, dan password dokumen.
3. PDF disimpan ke Vercel Blob.
4. Aplikasi menghasilkan link dokumen berdasarkan domain deployment.
5. User membuka link, password divalidasi lewat API, lalu PDF ditampilkan.
6. Setelah PDF pernah berhasil dibuka online, dokumen yang sama bisa dibuka offline dari cache PWA.

## Halaman Admin

Setelah deploy, buka:

```text
https://domain-vercel-anda.vercel.app/admin
```

Isi:

- Password admin
- Setelah login, dashboard menampilkan tabel PDF yang sudah diupload.
- Klik `Tambah PDF` untuk upload dokumen baru.
- Klik `Edit` untuk mengganti judul, password dokumen, atau file PDF.
- Klik `Hapus` untuk menghapus metadata dan file PDF dari Vercel Blob.
- Klik `Salin` untuk menyalin link dokumen.

Hasilnya berupa:

```text
Link: https://domain-vercel-anda.vercel.app/BOR-001?p=PASSWORD
Password: PASSWORD
```

Link ini bisa dijadikan QR.

## Environment Variables Vercel

Tambahkan environment variables berikut di Vercel Project Settings:

```text
ADMIN_PASSWORD=isi-password-admin-anda
BLOB_READ_WRITE_TOKEN=token-dari-vercel-blob
```

`ADMIN_PASSWORD` dipakai untuk melindungi halaman upload. `BLOB_READ_WRITE_TOKEN` dipakai API untuk menyimpan PDF dan metadata ke Vercel Blob.

## Deploy ke Vercel

Install dependency:

```bash
npm install
```

Deploy folder ini ke Vercel. File `vercel.json` sudah menyiapkan rewrite agar URL seperti `/BOR-001` tetap masuk ke PWA, sedangkan `/api/*` tetap masuk ke serverless API.

## Uji Lokal

Untuk tes lokal penuh tanpa Vercel Blob:

```bash
npm run dev
```

Buka:

```text
http://localhost:8080
```

Halaman admin lokal:

```text
http://localhost:8080/admin
```

Password admin lokal default:

```text
admin123
```

Kalau ingin mengganti password lokal:

```bash
ADMIN_PASSWORD=password-anda npm run dev
```

Data upload lokal disimpan di folder `.local-data/` dan tidak ikut deploy.

Untuk menguji upload admin dan API Vercel Blob secara lokal, gunakan Vercel CLI dengan environment variables yang sama:

```bash
vercel dev
```

## Catatan Keamanan

PDF disimpan di Vercel Blob dengan URL acak dan tidak ditampilkan sebelum password benar. Perlindungan utama ada di API aplikasi. Jangan membagikan URL Blob langsung.
# sop-pwa
