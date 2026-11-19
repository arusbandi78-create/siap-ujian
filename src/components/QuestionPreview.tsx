import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QuestionMediaView } from "@/components/QuestionMedia";
import { typeLabel } from "@/lib/labels";
import type { QuestionMedia } from "@/lib/question-media";

export type PreviewQuestion = {
  type: "pg" | "isian" | "bs" | "uraian";
  subject?: string;
  topic?: string;
  prompt: string;
  media: QuestionMedia | null;
  options?: string[];
  option_media?: (QuestionMedia | null)[];
  points?: number;
};

/** Renders a question exactly as students see it during the exam (read-only). */
export function QuestionPreview({ q }: { q: PreviewQuestion }) {
  const options = q.type === "pg" ? (q.options ?? []) : [];
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Badge>{typeLabel[q.type]}</Badge>
        {q.subject && <Badge variant="secondary">{q.subject}</Badge>}
        {q.topic && <Badge variant="outline">{q.topic}</Badge>}
        {q.points != null && <Badge variant="outline">{q.points} poin</Badge>}
      </div>
      {q.prompt
        ? <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{q.prompt}</p>
        : <p className="text-sm italic text-muted-foreground">(Tanpa teks pertanyaan — hanya media)</p>}
      <QuestionMediaView media={q.media} label="Media pertanyaan" exam />
      <div className="mt-6 space-y-3">
        {q.type === "pg" && options.map((text, k) => {
          const media = q.option_media?.[k] ?? null;
          if (!text && !media) return null;
          return (
            <div key={k} className="min-w-0 rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-muted-foreground">{String.fromCharCode(65 + k)}</span>
                <span className="min-w-0 break-words pt-0.5">{text || `Pilihan ${String.fromCharCode(65 + k)}`}</span>
              </div>
              <QuestionMediaView media={media} label={`Media pilihan ${String.fromCharCode(65 + k)}`} exam />
            </div>
          );
        })}
        {q.type === "bs" && (
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" variant="outline" disabled>Benar</Button>
            <Button size="lg" variant="outline" disabled>Salah</Button>
          </div>
        )}
        {q.type === "isian" && <Input placeholder="Ketik jawaban…" disabled />}
        {q.type === "uraian" && <Textarea rows={6} placeholder="Tulis jawaban uraian…" disabled />}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Pratinjau tampilan siswa — jawaban tidak dapat diisi di sini.</p>
    </div>
  );
}
