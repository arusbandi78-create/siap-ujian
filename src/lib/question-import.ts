import * as XLSX from "xlsx";

export type QType = "pg" | "isian" | "bs" | "uraian";
export type ParsedRow = {
  row: number;
  type: QType;
  subject: string;
  topic: string;
  prompt: string;
  options: string[];
  answer: unknown;
  points: number;
  error?: string;
};

const common = ["mapel", "topik", "soal", "poin"];
export const templates: Record<QType, { sheet: string; headers: string[]; example: (string | number)[][]; note: string }> = {
  pg: {
    sheet: "Pilihan Ganda",
    headers: [...common.slice(0, 3), "opsi_a", "opsi_b", "opsi_c", "opsi_d", "opsi_e", "kunci", "poin"],
    example: [
      ["Matematika", "Pecahan", "Hasil dari 1/2 + 1/4 adalah ...", "1/4", "2/4", "3/4", "1", "", "C", 2],
      ["IPA", "Tata Surya", "Planet terdekat dari Matahari adalah ...", "Venus", "Merkurius", "Mars", "Bumi", "", "B", 1],
    ],
    note: "Isi minimal 2 opsi (opsi_e boleh kosong). Kunci diisi huruf A–E.",
  },
  bs: {
    sheet: "Benar Salah",
    headers: [...common.slice(0, 3), "kunci", "poin"],
    example: [
      ["IPA", "Air", "Air mendidih pada suhu 100°C di permukaan laut.", "Benar", 1],
      ["IPS", "Geografi", "Ibu kota Indonesia adalah Surabaya.", "Salah", 1],
    ],
    note: "Kunci diisi Benar atau Salah.",
  },
  isian: {
    sheet: "Isian Singkat",
    headers: [...common.slice(0, 3), "kunci", "poin"],
    example: [
      ["Bahasa Indonesia", "Kata", "Lawan kata 'tinggi' adalah ...", "rendah;pendek", 1],
      ["Matematika", "Perkalian", "7 x 8 = ...", "56", 1],
    ],
    note: "Beberapa jawaban benar dipisah titik koma (;). Tidak membedakan huruf besar/kecil.",
  },
  uraian: {
    sheet: "Uraian",
    headers: [...common.slice(0, 3), "poin"],
    example: [["PKn", "Pancasila", "Jelaskan makna sila pertama Pancasila!", 10]],
    note: "Soal uraian dinilai manual oleh guru.",
  },
};

export function downloadTemplate(type?: QType) {
  const wb = XLSX.utils.book_new();
  const types = type ? [type] : (Object.keys(templates) as QType[]);
  for (const t of types) {
    const tp = templates[t];
    const ws = XLSX.utils.aoa_to_sheet([tp.headers, ...tp.example]);
    ws["!cols"] = tp.headers.map((h) => ({ wch: h === "soal" ? 50 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, tp.sheet);
  }
  const info = XLSX.utils.aoa_to_sheet([
    ["Petunjuk"],
    ["Hapus baris contoh lalu isi soal Anda. Jangan ubah judul kolom maupun nama sheet."],
    ...types.map((t) => [`${templates[t].sheet}: ${templates[t].note}`]),
    ["Poin: angka 1–100 (kosong = 1)."],
  ]);
  info["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, info, "Petunjuk");
  XLSX.writeFile(wb, type ? `template-soal-${t2(type)}.xlsx` : "template-soal-siapujian.xlsx");
}
const t2 = (t: QType) => templates[t].sheet.toLowerCase().replace(/\s+/g, "-");

const s = (v: unknown) => String(v ?? "").trim();

export function parseRow(type: QType, r: Record<string, unknown>, row: number): ParsedRow {
  const prompt = s(r["soal"]);
  const pts = s(r["poin"]) === "" ? 1 : Number(r["poin"]);
  const out: ParsedRow = { row, type, subject: s(r["mapel"]).slice(0, 80), topic: s(r["topik"]).slice(0, 80), prompt, options: [], answer: null, points: pts };
  if (!prompt) return { ...out, error: "Soal kosong" };
  if (prompt.length > 5000) return { ...out, error: "Soal terlalu panjang" };
  if (!Number.isInteger(pts) || pts < 1 || pts > 100) return { ...out, error: "Poin harus 1–100" };
  const key = s(r["kunci"]);
  if (type === "pg") {
    const letters = ["a", "b", "c", "d", "e"];
    const raw = letters.map((l) => s(r[`opsi_${l}`]));
    const last = raw.reduce((m, v, i) => (v ? i : m), -1);
    const opts = raw.slice(0, last + 1);
    if (opts.length < 2 || opts.some((o) => !o)) return { ...out, error: "Opsi minimal 2 dan berurutan tanpa celah" };
    const idx = letters.indexOf(key.toLowerCase());
    if (idx < 0 || idx >= opts.length) return { ...out, error: "Kunci harus huruf opsi yang terisi" };
    return { ...out, options: opts.map((o) => o.slice(0, 1000)), answer: idx };
  }
  if (type === "bs") {
    const k = key.toLowerCase();
    if (!["benar", "salah", "b", "s", "true", "false"].includes(k)) return { ...out, error: "Kunci harus Benar/Salah" };
    return { ...out, answer: ["benar", "b", "true"].includes(k) };
  }
  if (type === "isian") {
    const keys = key.split(";").map((x) => x.trim()).filter(Boolean);
    if (!keys.length) return { ...out, error: "Kunci jawaban kosong" };
    return { ...out, answer: keys };
  }
  return out;
}

export async function parseWorkbook(file: File): Promise<ParsedRow[]> {
  const wb = XLSX.read(await file.arrayBuffer());
  const rows: ParsedRow[] = [];
  for (const t of Object.keys(templates) as QType[]) {
    const ws = wb.Sheets[templates[t].sheet];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    data.forEach((r, i) => {
      const norm = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]));
      if (Object.values(norm).every((v) => s(v) === "")) return;
      rows.push(parseRow(t, norm, i + 2));
    });
  }
  return rows;
}
