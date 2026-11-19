import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readAllRows } from "@/lib/exam-rules";
import { typeLabel } from "@/lib/labels";
import { compactOptions, mediaSchema, parseMedia, type QuestionMedia } from "@/lib/question-media";
import { QuestionMediaEditor } from "@/components/QuestionMediaEditor";
import { QuestionMediaView } from "@/components/QuestionMedia";
import { QuestionPreview } from "@/components/QuestionPreview";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/guru/soal")({ head: () => ({ meta: [{ title: "Bank Soal — SiapUjian" }, { name: "description", content: "Kelola bank soal asesmen guru." }, { property: "og:title", content: "Bank Soal — SiapUjian" }, { property: "og:description", content: "Kelola bank soal asesmen guru." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: BankSoal });

type QType = "pg" | "isian" | "bs" | "uraian";
type Draft = { id?: string; type: QType; subject: string; topic: string; prompt: string; media: QuestionMedia | null; option_media: (QuestionMedia | null)[]; options: string[]; correct: number; bs: boolean; isian: string; points: number };
const empty: Draft = { type: "pg", subject: "", topic: "", prompt: "", media: null, option_media: [], options: ["", "", "", ""], correct: 0, bs: true, isian: "", points: 1 };

const base = z.object({
  subject: z.string().trim().max(80),
  topic: z.string().trim().max(80),
  prompt: z.string().trim().max(5000),
  points: z.number().int().min(1).max(100),
});

function BankSoal() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState({ q: "", type: "all" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewQ, setPreviewQ] = useState<(typeof list)[number] | null>(null);
  const [uploads, setUploads] = useState(0);
  const onBusy = (busy: boolean) => setUploads((n) => Math.max(0, n + (busy ? 1 : -1)));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === shown.length) setSelected(new Set());
    else setSelected(new Set(shown.map((q) => q.id)));
  };
  const { data: list = [] } = useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      return readAllRows((from, to) => supabase.from("questions").select("*").order("created_at", { ascending: false }).order("id").range(from, to));
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const b = base.parse(d);
      const media = d.media ? mediaSchema.parse(d.media) : null;
      if (!b.prompt && !media) throw new Error("Isi pertanyaan atau tambahkan media.");
      let options: string[] = [];
      let option_media: (QuestionMedia | null)[] = [];
      let answer: unknown = null;
      if (d.type === "pg") {
        const result = compactOptions(d.options, d.option_media, d.correct);
        options = result.options; option_media = result.option_media; answer = result.answer;
      } else if (d.type === "bs") answer = d.bs;
      else if (d.type === "isian") {
        const keys = d.isian.split(";").map((s) => s.trim()).filter(Boolean);
        if (!keys.length) throw new Error("Isi kunci jawaban (pisahkan dengan ;)");
        answer = keys;
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Silakan masuk kembali.");
      const row = { ...b, media, option_media, type: d.type, options, answer: answer as never, teacher_id: u.user.id };
      const { error } = d.id
        ? await supabase.from("questions").update(row).eq("id", d.id)
        : await supabase.from("questions").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Soal disimpan");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["questions"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMany = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("questions").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questions"] });
      setSelected(new Set());
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function edit(q: (typeof list)[number]) {
    setPreviewing(false);
    const opts = (q.options as string[]) ?? [];
    setDraft({
      id: q.id, type: q.type, subject: q.subject, topic: q.topic, prompt: q.prompt, points: q.points,
      media: parseMedia(q.media), option_media: Array.isArray(q.option_media) ? q.option_media.map(parseMedia) : [],
      options: q.type === "pg" ? [...opts, ...Array(Math.max(0, 4 - opts.length)).fill("")] : ["", "", "", ""],
      correct: q.type === "pg" ? Number(q.answer ?? 0) : 0,
      bs: q.type === "bs" ? Boolean(q.answer) : true,
      isian: q.type === "isian" ? ((q.answer as string[]) ?? []).join("; ") : "",
    });
  }

  const shown = list.filter(
    (q) =>
      (filter.type === "all" || q.type === filter.type) &&
      `${q.prompt} ${q.subject} ${q.topic}`.toLowerCase().includes(filter.q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Bank Soal"
        desc={`${list.length} soal tersimpan`}
        action={
          <div className="flex items-end gap-2">
            <Button onClick={() => { setPreviewing(false); setDraft({ ...empty, options: ["", "", "", ""] }); }}><Plus className="h-4 w-4" /> Soal baru</Button>
            {selected.size > 0 ? (
              <>
                <Button variant="outline" size="sm" onClick={() => toggleSelectAll()}>Pilih semua</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (window.confirm(`Hapus ${selected.size} soal terpilih?`)) deleteMany.mutate(Array.from(selected)); }} disabled={deleteMany.isPending}><Trash2 className="h-4 w-4" /> Hapus terpilih</Button>
              </>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => { if (window.confirm("Hapus semua soal? Tindakan tidak dapat dibatalkan.")) deleteMany.mutate(list.map((q) => q.id)); }} disabled={deleteMany.isPending || list.length === 0}><Trash2 className="h-4 w-4" /> Hapus semua</Button>
            )}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Cari soal, mapel, topik…" className="max-w-xs" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <Select value={filter.type} onValueChange={(v) => setFilter({ ...filter, type: v })}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tipe</SelectItem>
            {Object.entries(typeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {shown.length === 0 && <Empty>Belum ada soal.</Empty>}
      <div className="grid gap-3">
        {shown.map((q) => (
          <div key={q.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selected.has(q.id)}
                  onCheckedChange={() => toggleSelect(q.id)}
                  aria-label={`Pilih soal ${q.id}`}
                />
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    <Badge>{typeLabel[q.type]}</Badge>
                    {q.subject && <Badge variant="secondary">{q.subject}</Badge>}
                    {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                    <Badge variant="outline">{q.points} poin</Badge>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{q.prompt}</p>
                  <QuestionMediaView media={parseMedia(q.media)} label="Media pertanyaan" />
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => setPreviewQ(q)} aria-label="Pratinjau tampilan siswa" title="Pratinjau tampilan siswa"><Eye className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => edit(q)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Hapus" onClick={() => confirm("Hapus soal ini?") && del.mutate(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && uploads === 0 && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit soal" : "Soal baru"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant={previewing ? "default" : "outline"} onClick={() => setPreviewing(!previewing)} aria-pressed={previewing}>
                  <Eye className="h-4 w-4" /> {previewing ? "Tutup pratinjau" : "Pratinjau tampilan siswa"}
                </Button>
              </div>
              {previewing && (
                <QuestionPreview q={{
                  type: draft.type, subject: draft.subject, topic: draft.topic, prompt: draft.prompt,
                  media: draft.media, options: draft.options, option_media: draft.option_media, points: draft.points,
                }} />
              )}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Tipe</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as QType })} disabled={!!draft.id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(typeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Mapel</Label><Input value={draft.subject} maxLength={80} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Topik</Label><Input value={draft.topic} maxLength={80} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Pertanyaan</Label><Textarea rows={4} value={draft.prompt} maxLength={5000} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} /></div>
              <QuestionMediaEditor value={draft.media} label="pertanyaan" onBusy={onBusy} onChange={(media) => setDraft((d) => d ? { ...d, media } : d)} />
              {draft.type === "pg" && (
                <div className="space-y-2">
                  <Label>Opsi jawaban (pilih kunci)</Label>
                  {draft.options.map((o, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <input type="radio" name="correct" checked={draft.correct === i} onChange={() => setDraft({ ...draft, correct: i })} className="h-4 w-4 accent-primary" aria-label={`Kunci ${i + 1}`} />
                      <span className="w-5 text-sm font-bold text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                      <div className="min-w-0 flex-1 space-y-2"><Input aria-label={`Teks opsi ${String.fromCharCode(65 + i)}`} value={o} maxLength={1000} onChange={(e) => { const opts = [...draft.options]; opts[i] = e.target.value; setDraft({ ...draft, options: opts }); }} />
                      <QuestionMediaEditor value={draft.option_media[i] ?? null} label={`opsi ${String.fromCharCode(65 + i)}`} onBusy={onBusy} onChange={(media) => setDraft((d) => { if (!d) return d; const items = [...d.option_media]; items[i] = media; return { ...d, option_media: items }; })} /></div>
                      {draft.options.length > 2 && (
                        <Button size="icon" variant="ghost" disabled={uploads > 0} onClick={() => { const opts = draft.options.filter((_, j) => j !== i); setDraft({ ...draft, options: opts, option_media: draft.options.map((_, j) => draft.option_media[j] ?? null).filter((_, j) => j !== i), correct: draft.correct > i ? draft.correct - 1 : Math.min(draft.correct, opts.length - 1) }); }}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  {draft.options.length < 6 && <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}>Tambah opsi</Button>}
                </div>
              )}
              {draft.type === "bs" && (
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <Button key={String(v)} type="button" variant={draft.bs === v ? "default" : "outline"} onClick={() => setDraft({ ...draft, bs: v })}>{v ? "Benar" : "Salah"}</Button>
                  ))}
                </div>
              )}
              {draft.type === "isian" && (
                <div className="space-y-1.5"><Label>Kunci jawaban (boleh lebih dari satu, pisahkan dengan ;)</Label><Input value={draft.isian} maxLength={1000} onChange={(e) => setDraft({ ...draft, isian: e.target.value })} placeholder="Jakarta; DKI Jakarta" /></div>
              )}
              {draft.type === "uraian" && <p className="text-sm text-muted-foreground">Soal uraian dinilai manual oleh guru di halaman hasil.</p>}
              <div className="w-32 space-y-1.5"><Label>Poin</Label><Input type="number" min={1} max={100} value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={uploads > 0} onClick={() => setDraft(null)}>Batal</Button>
            <Button onClick={() => draft && save.mutate(draft)} disabled={save.isPending || uploads > 0}>{uploads > 0 ? "Mengunggah…" : save.isPending ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewQ} onOpenChange={(o) => !o && setPreviewQ(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Pratinjau tampilan siswa</DialogTitle></DialogHeader>
          {previewQ && (
            <QuestionPreview q={{
              type: previewQ.type, subject: previewQ.subject, topic: previewQ.topic, prompt: previewQ.prompt,
              media: parseMedia(previewQ.media),
              options: (previewQ.options as string[]) ?? [],
              option_media: Array.isArray(previewQ.option_media) ? previewQ.option_media.map(parseMedia) : [],
              points: previewQ.points,
            }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
