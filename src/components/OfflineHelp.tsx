import { CloudCheck, CloudUpload, HardDrive, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const STEPS = [
  "Tetap tenang dan lanjutkan mengerjakan soal. Jawabanmu otomatis tersimpan di perangkat ini.",
  "Jangan menutup aplikasi, memuat ulang paksa, atau menghapus data/riwayat browser.",
  "Jangan berpindah ke aplikasi lain untuk mengecek internet — itu tercatat sebagai pelanggaran. Beri tahu pengawas dengan mengangkat tangan.",
  "Timer tetap berjalan. Jika waktu habis saat offline, jawaban dikirim otomatis begitu koneksi kembali.",
  "YouTube memerlukan internet. Gambar, audio, dan video yang belum termuat mungkin tidak tersedia saat offline; hubungi pengawas jika media tidak dapat dibuka.",
  "Jika aplikasi tertutup atau kamu keluar dari ujian, buka kembali SiapUjian di perangkat yang sama dan hubungi guru. Soal dan jawaban tetap tersimpan, tetapi pengerjaan hanya dapat dilanjutkan setelah guru memberi izin dan internet tersambung.",
  "Perhatikan status di bagian atas: \"Tersimpan di perangkat\" berarti belum terkirim; \"Terkirim ke server\" berarti sudah aman di server.",
  "Kirim jawaban akhir hanya setelah status menunjukkan terkirim, atau tunggu sampai koneksi pulih — pengiriman akan dilanjutkan otomatis.",
];

export function OfflineHelp({ compact = false }: { compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={compact ? "outline" : "secondary"} size="sm" className={compact ? "" : "w-full"}>
          <HelpCircle className="h-4 w-4" /> Apa yang harus dilakukan jika koneksi terputus?
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jika koneksi internet terputus</DialogTitle>
          <DialogDescription>Ikuti langkah berikut agar jawabanmu tidak hilang.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-2.5 text-sm">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

export function SyncStatus({ online, syncing, pending, savedAt }: { online: boolean; syncing: boolean; pending: number; savedAt: Date | null }) {
  if (syncing)
    return <p className="flex items-center gap-1 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Mengirim ke server…</p>;
  if (pending > 0)
    return (
      <p className="flex items-center gap-1 text-xs font-medium text-warning-foreground">
        <HardDrive className="h-3 w-3" /> {pending} jawaban tersimpan di perangkat{online ? " — segera dikirim" : " — menunggu koneksi"}
      </p>
    );
  return (
    <p className="flex items-center gap-1 text-xs text-success">
      {savedAt ? <CloudCheck className="h-3 w-3" /> : <CloudUpload className="h-3 w-3" />}
      {savedAt ? `Semua jawaban terkirim ke server · ${savedAt.toLocaleTimeString("id-ID")}` : online ? "Terkirim ke server" : "Offline"}
    </p>
  );
}
