export const typeLabel: Record<string, string> = {
  pg: "Pilihan Ganda",
  isian: "Isian",
  bs: "Benar-Salah",
  uraian: "Uraian",
};

export const statusLabel: Record<string, string> = {
  ready: "Belum mulai",
  in_progress: "Mengerjakan",
  suspended: "Ditangguhkan",
  submitted: "Selesai",
};

export const violationLabel: Record<string, string> = {
  tab_hidden: "Pindah tab / minimize",
  window_blur: "Meninggalkan jendela",
  exit_fullscreen: "Keluar layar penuh",
  navigation: "Mencoba navigasi",
  page_exit: "Menutup / memuat ulang ujian",
};

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";

export function durationText(start?: string | null, end?: string | null) {
  if (!start || !end) return "-";
  const m = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  return `${m} menit`;
}

export function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  return [...arr].map((n) => c[n % c.length]).join("");
}

/** datetime-local <-> ISO helpers */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => new Date(v).toISOString();
