import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readAllRows } from "@/lib/exam-rules";
import { fromLocalInput, toLocalInput, typeLabel } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/guru/ujian/$id")({ head: () => ({ meta: [{ title: "Pengaturan Ujian — SiapUjian" }, { name: "description", content: "Atur jumlah soal, pengacakan dan keamanan ujian." }, { property: "og:title", content: "Pengaturan Ujian — SiapUjian" }, { property: "og:description", content: "Atur jumlah soal, pengacakan dan keamanan ujian." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: ExamEditor });

type Exam = Database["public"]["Tables"]["exams"]["Row"];

const schema = z
  .object({
    title: z.string().trim().min(3, "Judul minimal 3 karakter").max(150),
    subject: z.string().trim().max(80),
    code: z.string().trim().regex(/^[A-Z0-9]{4,12}$/, "Kode 4–12 huruf/angka kapital"),
    instructions: z.string().max(5000),
    duration_minutes: z.number().int().min(1, "Durasi minimal 1 menit").max(600),
    question_count: z.number().int().min(1, "Tetapkan jumlah soal per siswa"),
    kkm: z.number().int().min(0).max(100),
    max_violations: z.number().int().min(1).max(50),
    start_at: z.string(),
    end_at: z.string(),
  })
  .refine((d) => new Date(d.end_at) > new Date(d.start_at), "Waktu selesai harus setelah waktu mulai");

function ExamEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [e, setE] = useState<Exam | null>(null);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["exam", id],
    queryFn: async () => {
      const [ex, eq, qs] = await Promise.all([
        supabase.from("exams").select("*").eq("id", id).single(),
        readAllRows((from, to) => supabase.from("exam_questions").select("question_id").eq("exam_id", id).order("question_id").range(from, to)),
        readAllRows((from, to) => supabase.from("questions").select("id, type, prompt, subject, topic, points").order("created_at", { ascending: false }).order("id").range(from, to)),
      ]);
      if (ex.error) throw ex.error;
      return { exam: ex.data, selected: new Set((eq).map((r) => r.question_id)), questions: qs };
    },
  });
  useEffect(() => { if (data) setE(data.exam); }, [data]);

  if (!e || !data) return <p className="text-muted-foreground">Memuat…</p>;
  const set = <K extends keyof Exam>(k: K, v: Exam[K]) => setE({ ...e, [k]: v });

  async function save() {
    if (!e || !data) return;
    const p = schema.safeParse(e);
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    if (p.data.question_count > data.selected.size) { toast.error("Pilih soal yang cukup di tab Soal sebelum menyimpan."); return; }
    setSaving(true);
    const { error } = await supabase.from("exams").update({
      ...p.data,
      shuffle_questions: e.shuffle_questions, shuffle_options: e.shuffle_options, show_results: e.show_results,
      is_active: e.is_active, require_fullscreen: e.require_fullscreen, violation_action: "suspend", max_violations: 1,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Kode ujian sudah dipakai" : error.message); return; }
    toast.success("Pengaturan disimpan");
    qc.invalidateQueries({ queryKey: ["exams"] });
  }

  async function toggleQ(qid: string, on: boolean) {
    if (!data) return;
    const { error } = on
      ? await supabase.from("exam_questions").insert({ exam_id: id, question_id: qid, position: data.selected.size })
      : await supabase.from("exam_questions").delete().eq("exam_id", id).eq("question_id", qid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["exam", id] });
  }

  async function remove() {
    if (!confirm("Hapus ujian ini beserta semua hasilnya?")) return;
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/guru/ujian" });
  }

  return (
    <div>
      <Link to="/guru/ujian" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Semua ujian</Link>
      <PageHeader title={e.title} desc={`Kode ujian: ${e.code}`} action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
        </div>} />
      <Tabs defaultValue="umum">
        <TabsList><TabsTrigger value="umum">Umum</TabsTrigger><TabsTrigger value="soal">Soal ({data.selected.size})</TabsTrigger><TabsTrigger value="mode">Exam Mode</TabsTrigger></TabsList>

        <TabsContent value="umum" className="mt-4 grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2">
          <F label="Judul"><Input value={e.title} maxLength={150} onChange={(x) => set("title", x.target.value)} /></F>
          <F label="Mata pelajaran"><Input value={e.subject} maxLength={80} onChange={(x) => set("subject", x.target.value)} /></F>
          <F label="Kode ujian"><Input className="font-mono uppercase tracking-widest" value={e.code} maxLength={12} onChange={(x) => set("code", x.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></F>
          <F label="Durasi (menit)"><Input type="number" min={1} value={e.duration_minutes} onChange={(x) => set("duration_minutes", Number(x.target.value))} /></F>
          <F label="Jadwal mulai"><Input type="datetime-local" value={toLocalInput(e.start_at)} onChange={(x) => x.target.value && set("start_at", fromLocalInput(x.target.value))} /></F>
          <F label="Jadwal selesai"><Input type="datetime-local" value={toLocalInput(e.end_at)} onChange={(x) => x.target.value && set("end_at", fromLocalInput(x.target.value))} /></F>
          <F label="Jumlah soal per siswa"><Input type="number" min={1} value={e.question_count ?? ""} onChange={(x) => set("question_count", x.target.value ? Number(x.target.value) : null)} /></F>
          <F label="KKM (0–100)"><Input type="number" min={0} max={100} value={e.kkm} onChange={(x) => set("kkm", Number(x.target.value))} /></F>
          <div className="md:col-span-2"><F label="Instruksi untuk siswa"><Textarea rows={4} maxLength={5000} value={e.instructions} onChange={(x) => set("instructions", x.target.value)} /></F></div>
          <Toggle label="Ujian aktif" desc="Siswa dapat masuk dengan kode ini" v={e.is_active} on={(v) => set("is_active", v)} />
          <Toggle label="Izinkan siswa melihat nilai" desc="Nilai tampil setelah siswa mengirim" v={e.show_results} on={(v) => set("show_results", v)} />
          <Toggle label="Acak pilihan dan urutan soal per siswa" desc="Diambil sesuai jumlah soal; soal antar siswa dapat sama atau berbeda" v={e.shuffle_questions} on={(v) => set("shuffle_questions", v)} />
          <Toggle label="Acak opsi pilihan ganda" v={e.shuffle_options} on={(v) => set("shuffle_options", v)} />
        </TabsContent>

        <TabsContent value="soal" className="mt-4 space-y-2">
          {data.questions.length === 0 && <p className="text-sm text-muted-foreground">Bank soal kosong. <Link to="/guru/soal" className="text-primary">Tambah soal</Link></p>}
          {data.questions.map((q) => {
            const on = data.selected.has(q.id);
            return (
              <label key={q.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 ${on ? "border-primary" : ""}`}>
                <input type="checkbox" checked={on} onChange={(x) => toggleQ(q.id, x.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
                <div className="min-w-0">
                  <div className="mb-1 flex gap-1.5"><Badge variant="secondary">{typeLabel[q.type]}</Badge>{q.subject && <Badge variant="outline">{q.subject}</Badge>}<Badge variant="outline">{q.points} poin</Badge></div>
                  <p className="line-clamp-2 text-sm">{q.prompt}</p>
                </div>
              </label>
            );
          })}
        </TabsContent>

        <TabsContent value="mode" className="mt-4 space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-start gap-3 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Exam Mode memantau perpindahan tab, keluar layar penuh, dan meninggalkan jendela. Tidak menggunakan kamera/mikrofon. Browser tidak dapat mengunci perangkat 100% — untuk penguncian penuh gunakan perangkat kiosk/managed device.</p>
          </div>
          <Toggle label="Wajib layar penuh (fullscreen)" v={e.require_fullscreen} on={(v) => set("require_fullscreen", v)} />
          <p className="text-sm text-destructive">Keluar dari halaman, berpindah tab/jendela, menutup, atau memuat ulang ujian langsung menangguhkan pengerjaan. Hanya guru yang dapat mengizinkan kembali melalui halaman Hasil. Jawaban tidak dihapus dan timer tetap berjalan.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Toggle({ label, desc, v, on }: { label: string; desc?: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <div><p className="text-sm font-medium">{label}</p>{desc && <p className="text-xs text-muted-foreground">{desc}</p>}</div>
      <Switch checked={v} onCheckedChange={on} />
    </div>
  );
}
