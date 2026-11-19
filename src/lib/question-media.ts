import { z } from "zod";

export const MEDIA_BUCKET = "question-media";
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export function youtubeId(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)) {
      id = u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(?:embed|shorts)\/([^/]+)$/.exec(u.pathname)?.[1] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export const mediaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("youtube"), url: z.string().max(300).refine((v) => !!youtubeId(v), "Tautan YouTube tidak valid").transform((v) => `https://www.youtube.com/watch?v=${youtubeId(v)}`) }),
  ...(["image", "audio", "video"] as const).map((kind) => z.object({ kind: z.literal(kind), path: z.string().max(200).regex(/^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|gif|mp3|wav|ogg|m4a|mp4|webm)$/), name: z.string().max(255).optional() })),
]);
export type QuestionMedia = z.infer<typeof mediaSchema>;
export type PlayableMedia = QuestionMedia & { src?: string };
export function parseMedia(value: unknown): QuestionMedia | null {
  const parsed = mediaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
const formats: Record<string, { kind: "image" | "audio" | "video"; mime: string[] }> = {
  png: { kind: "image", mime: ["image/png"] }, jpg: { kind: "image", mime: ["image/jpeg"] }, jpeg: { kind: "image", mime: ["image/jpeg"] }, webp: { kind: "image", mime: ["image/webp"] }, gif: { kind: "image", mime: ["image/gif"] },
  mp3: { kind: "audio", mime: ["audio/mpeg"] }, wav: { kind: "audio", mime: ["audio/wav", "audio/x-wav"] }, ogg: { kind: "audio", mime: ["audio/ogg"] }, m4a: { kind: "audio", mime: ["audio/mp4", "audio/x-m4a"] },
  mp4: { kind: "video", mime: ["video/mp4"] }, webm: { kind: "video", mime: ["video/webm"] },
};
export function validateMediaFile(file: { name: string; type: string; size: number }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = formats[ext];
  if (!format || !format.mime.includes(file.type)) throw new Error("Format berkas tidak didukung. Gunakan gambar, MP3/WAV/OGG/M4A, atau MP4/WebM.");
  if (file.size <= 0 || file.size > MAX_MEDIA_BYTES) throw new Error("Ukuran berkas harus antara 1 byte dan 50 MB.");
  return { kind: format.kind, ext };
}
export function compactOptions(texts: string[], media: (QuestionMedia | null)[], correct: number) {
  const rows = texts.map((text, i) => ({ text: text.trim(), media: media[i] ? mediaSchema.parse(media[i]) : null, i })).filter((o) => o.text || o.media);
  if (rows.length < 2 || rows.length > 6) throw new Error("Isi minimal 2 dan maksimal 6 opsi jawaban.");
  if (rows.some((o) => o.text.length > 1000)) throw new Error("Opsi terlalu panjang.");
  const answer = rows.findIndex((o) => o.i === correct);
  if (answer < 0) throw new Error("Pilih kunci jawaban yang terisi.");
  return { options: rows.map((o) => o.text), option_media: rows.map((o) => o.media), answer };
}