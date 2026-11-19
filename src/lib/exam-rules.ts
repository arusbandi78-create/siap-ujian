export const BANK_PAGE_SIZE = 500;
export const ANSWER_BATCH_SIZE = 200;

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const x = a[i]; const y = a[j];
    if (x !== undefined && y !== undefined) { a[i] = y; a[j] = x; }
  }
  return a;
}

export function selectExamQuestions(ids: string[], count: number | null, shuffle: boolean, seed: string) {
  if (!count || !Number.isSafeInteger(count) || count < 1) throw new Error("Guru harus menetapkan jumlah soal per siswa.");
  if (count > ids.length) throw new Error("Jumlah soal dalam ujian belum mencukupi batas yang ditetapkan guru.");
  return (shuffle ? seededShuffle(ids, seed) : ids).slice(0, count);
}

export async function readAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += BANK_PAGE_SIZE) {
    const { data, error } = await page(from, from + BANK_PAGE_SIZE - 1);
    if (error) throw error;
    result.push(...(data ?? []));
    if (!data || data.length < BANK_PAGE_SIZE) return result;
  }
}

export function batches<T>(rows: T[], size = ANSWER_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}