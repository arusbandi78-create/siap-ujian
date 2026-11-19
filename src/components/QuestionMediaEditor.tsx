import { useRef, useState } from "react";
import { ImagePlus, Music, Video, Youtube, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuestionMediaView } from "./QuestionMedia";
import { MEDIA_BUCKET, mediaSchema, validateMediaFile, type QuestionMedia } from "@/lib/question-media";

export function QuestionMediaEditor({ value, onChange, label, onBusy }: { value: QuestionMedia | null; onChange: (m: QuestionMedia | null) => void; label: string; onBusy: (busy: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [youtube, setYoutube] = useState(false);
  const [url, setUrl] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    try {
      const { kind, ext } = validateMediaFile(file);
      setBusy(true); onBusy(true);
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Silakan masuk kembali.");
      const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      onChange(mediaSchema.parse({ kind, path, name: file.name }));
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); onBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  return <div className="min-w-0 space-y-2">
    <input ref={fileRef} type="file" aria-label={`Unggah media ${label}`} className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,video/mp4,video/webm" onChange={(e) => void upload(e.target.files?.[0])} />
    <div className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={`Unggah media ${label}`}><Upload className="h-4 w-4" />{busy ? "Mengunggah…" : "Media"}<ImagePlus className="h-3.5 w-3.5" /><Music className="h-3.5 w-3.5" /><Video className="h-3.5 w-3.5" /></Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setYoutube(!youtube); setUrl(value?.kind === "youtube" ? value.url : ""); }}><Youtube className="h-4 w-4" />YouTube</Button>
      {value && <Button size="icon" variant="ghost" disabled={busy} title="Hapus media" aria-label={`Hapus media ${label}`} onClick={() => onChange(null)}><X className="h-4 w-4" /></Button>}
    </div>
    {youtube && <div className="flex gap-2"><Input aria-label={`Tautan YouTube ${label}`} placeholder="https://www.youtube.com/watch?v=…" value={url} maxLength={300} onChange={(e) => setUrl(e.target.value)} /><Button size="sm" disabled={busy} onClick={() => { const result = mediaSchema.safeParse({ kind: "youtube", url }); if (!result.success) { toast.error("Tautan YouTube tidak valid."); return; } onChange(result.data); setYoutube(false); }}>Pasang</Button></div>}
    {value?.kind !== "youtube" && value && <p className="truncate text-xs text-muted-foreground">{value.name}</p>}
    <QuestionMediaView media={value} label={label} />
  </div>;
}