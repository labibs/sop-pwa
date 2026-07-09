# Manual SAKTE PWA

Next.js PWA untuk membuka PDF SOP dari QR URL seperti:

```text
https://manual.sakte.id/BOR-001?p=PASSWORD
```

Alur aplikasi:

1. Admin login di `/admin`.
2. Admin upload PDF, judul, kode dokumen, dan password dokumen.
3. PDF dan metadata disimpan ke Vercel Blob.
4. Aplikasi menghasilkan link dokumen berdasarkan domain deployment.
5. User membuka link, password divalidasi lewat API, lalu PDF ditampilkan.
6. Setelah PDF pernah berhasil dibuka online, dokumen yang sama bisa dibuka offline dari cache PWA.

## Environment Variables

Tambahkan di Vercel Project Settings:

```text
ADMIN_PASSWORD=isi-password-admin-anda
BLOB_READ_WRITE_TOKEN=token-dari-vercel-blob
```

`BLOB_READ_WRITE_TOKEN` bisa dibuat dengan connect Vercel Blob ke project dari tab Storage.

## Deploy ke Vercel

Project ini sekarang memakai Next.js. Di Vercel:

- Framework Preset: `Next.js`
- Build Command: default, atau `npm run build`
- Install Command: default, atau `npm install`
- Root Directory: folder yang berisi `package.json`, `app/`, dan `public/`

Tidak perlu `vercel.json`, custom server, atau output directory khusus.

## Uji Lokal

Install dependency:

```bash
npm install
```

Jalankan:

```bash
npm run dev
```

Buka:

```text
http://localhost:3000
http://localhost:3000/admin
```

Untuk upload PDF lokal, jalankan dengan env yang sama:

```bash
ADMIN_PASSWORD=admin123 BLOB_READ_WRITE_TOKEN=token-blob npm run dev
```

Atau pakai `vercel dev` setelah environment variables tersambung ke project Vercel.

## Admin

Setelah login di `/admin`, dashboard menampilkan tabel PDF:

- `Tambah PDF` untuk upload dokumen baru.
- `Edit` untuk mengganti judul, password, atau file PDF.
- `Hapus` untuk menghapus metadata dan file PDF dari Vercel Blob.
- `Salin` untuk menyalin link dokumen.

Password dokumen disimpan sebagai hash, jadi tidak ditampilkan ulang. Kalau lupa, edit dokumen dan isi password baru.
