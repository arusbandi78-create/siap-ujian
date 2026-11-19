# Rencana: Aplikasi Ulangan/Asesmen Digital

## Tujuan
Aplikasi ujian berbasis web untuk guru dan siswa, tema putih-biru modern, responsif (HP/tablet/komputer), benar-benar berfungsi dengan data tersimpan aman di Lovable Cloud.

## Alur Siswa
```text
LOGIN (kode ujian + username + PIN) -> INSTRUKSI -> MULAI (fullscreen)
-> SOAL + TIMER + NAVIGASI -> KIRIM -> KONFIRMASI -> SELESAI
```

## Halaman
1. **Login** – tab Guru (email + kata sandi) dan Siswa (kode ujian, username, PIN).
2. **Dashboard Guru** – ringkasan ujian aktif, peserta, rata-rata nilai, pelanggaran terbaru.
3. **Bank Soal** – buat/edit/hapus soal: Pilihan Ganda, Isian, Benar-Salah, Uraian; filter mapel/topik.
4. **Manajemen Ujian** – judul, mapel, durasi, jadwal mulai/selesai, jumlah soal, acak soal/opsi, KKM, bobot nilai, izin lihat hasil, kode ujian otomatis.
5. **Peserta** – kelola akun siswa (username + PIN), impor sederhana, tetapkan ke ujian.
6. **Pengaturan Exam Mode** – per ujian: wajib fullscreen, batas pelanggaran, tindakan otomatis (peringatan / tangguhkan / kirim otomatis).
7. **Hasil** – nilai, waktu pengerjaan, status (belum/sedang/selesai/ditangguhkan), statistik (rata-rata, tertinggi, terendah, % lulus KKM), penilaian manual soal uraian.
8. **Audit Log** – setiap pelanggaran dengan timestamp, jenis, siswa; tombol "Verifikasi & Lanjutkan" untuk siswa yang ditangguhkan.
9. **Siswa: Instruksi, Ujian, Selesai** – soal, timer, panel nomor soal (dijawab/ragu/kosong), konfirmasi kirim.

## Exam Mode
- Fullscreen saat MULAI; deteksi keluar fullscreen, pindah tab (Page Visibility), blur/focus window.
- Setiap pelanggaran dicatat di server + peringatan: "Terdeteksi aktivitas meninggalkan halaman ujian. Silakan kembali ke ujian".
- Melewati batas: layar "Ujian Ditangguhkan", menunggu verifikasi guru. Jawaban tidak dihapus.
- Blok klik kanan, salin/tempel, dan tombol kembali browser.
- Tanpa kamera/mikrofon, tanpa pengambilan data pribadi.
- Catatan di halaman instruksi: browser tidak bisa mengunci perangkat 100%; untuk penguncian penuh gunakan kiosk/managed device.

## Autosave & Timer
- Jawaban disimpan otomatis setiap perubahan (debounce) dan berkala; cadangan lokal saat offline, disinkronkan ketika koneksi pulih.
- Waktu berakhir dihitung dari server; saat habis, ujian terkunci dan terkirim otomatis.
- Soal tidak bisa dibuka sebelum jadwal; hasil hanya tampil jika diizinkan guru.

## Keamanan
- Peran guru/siswa di tabel terpisah, dicek di server; aturan akses database per baris.
- Kunci jawaban tidak pernah dikirim ke perangkat siswa; penilaian di server.
- Validasi semua input, React escaping (anti-XSS), token bearer (bukan cookie) sehingga aman dari CSRF.
- PIN siswa di-hash.

## Detail Teknis
- Lovable Cloud: auth guru (email/password), siswa login via server function yang memverifikasi kode+username+PIN lalu menerbitkan sesi akun siswa (email sintetis).
- Tabel: profiles, user_roles, students, questions, question_options, exams, exam_questions, exam_settings, attempts, answers, violations.
- Server functions (createServerFn + requireSupabaseAuth) untuk mulai ujian, simpan jawaban, catat pelanggaran, kirim, penilaian, verifikasi.
- Route: `/` (login), `/_authenticated/guru/*`, `/_authenticated/siswa/*`.
- Desain: font Plus Jakarta Sans, token warna biru di styles.css, komponen shadcn.
- Data contoh: 1 guru, beberapa soal & 1 ujian demo.
