import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, ShieldCheck, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, Empty } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { durationText, fmtDate, statusLabel, typeLabel, violationLabel } from "@/lib/labels";
import { QuestionMediaView } from "@/components/QuestionMedia";
import { parseMedia } from "@/lib/question-media";

export const Route = createFileRoute("/_authenticated/guru/hasil/$id")({ head: () => ({ meta: [{ title: "Hasil Ujian — SiapUjian" }, { name: "description", content: "Nilai siswa dan verifikasi izin melanjutkan ujian." }, { property: "og:title", content: "Hasil Ujian — SiapUjian" }, { property: "og:description", content: "Nilai siswa dan verifikasi izin melanjutkan ujian." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Hasil });

function Hasil() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [detail, setDetail] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["results", id],
    refetchInterval: 10000,
    queryFn: async () => {
      const [ex, at] = await Promise.all([
        supabase.from("exams").select("title, code, kkm").eq("id", id).single(),
        supabase.from("attempts").select("id, status, score, started_at, submitted_at, deadline_at, violation_count, students(full_name, username, class_name)").eq("exam_id", id).order("created_at"),
      ]);
      if (ex.error) throw ex.error;
      return { exam: ex.data, attempts: (at.data ?? []) as any[] };
    },
  });
  if (!data) return <p className="text-muted-foreground">Memuat…</p>;

  const done = data.attempts.filter((a) => a.status === "submitted" && a.score != null);
  const scores = done.map((a) => Number(a.score));
  const avg = scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : "-";
  const pass = scores.filter((s) => s >= data.exam.kkm).length;

  async function verify(aid: string) {
    if (!confirm("Verifikasi siswa dan izinkan melanjutkan ujian? Penghitung pelanggaran direset (riwayat tetap tersimpan).")) return;
    const { error } = await supabase.from("attempts").update({ status: "in_progress", violation_count: 0 }).eq("id", aid).eq("status", "suspended");
    error ? toast.error(error.message) : toast.success("Siswa dapat melanjutkan ujian");
    qc.invalidateQueries({ queryKey: ["results", id] });
  }
  async function reset(aid: string) {
    if (!confirm("Hapus percobaan ini? Siswa akan mengulang dari awal.")) return;
    const { error } = await supabase.from("attempts").delete().eq("id", aid);
    error ? toast.error(error.message) : qc.invalidateQueries({ queryKey: ["results", id] });
  }

  function exportCsv() {
    if (!data) return;
    const rows = [["Nama", "Username", "Kelas", "Status", "Nilai", "Mulai", "Selesai", "Pelanggaran"]];
    data.attempts.forEach((a) => rows.push([a.students?.full_name, a.students?.username, a.students?.class_name, statusLabel[a.status], a.score ?? "", a.started_at ?? "", a.submitted_at ?? "", a.violation_count]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = `hasil-${data.exam.code}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Link to="/guru/ujian" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Semua ujian</Link>
      <PageHeader title={`Hasil: ${data.exam.title}`} desc={`Kode ${data.exam.code} · KKM ${data.exam.kkm}`} action={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Unduh CSV</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Peserta" value={data.attempts.length} />
        <StatCard label="Selesai" value={done.length} />
        <StatCard label="Rata-rata" value={avg} />
        <StatCard label="Tertinggi / Terendah" value={scores.length ? `${Math.max(...scores)} / ${Math.min(...scores)}` : "-"} />
        <StatCard label="Lulus KKM" value={scores.length ? `${Math.round((pass / scores.length) * 100)}%` : "-"} hint={`${pass} dari ${scores.length}`} />
      </div>
      {data.attempts.length === 0 ? <Empty>Belum ada siswa yang masuk ujian ini.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Siswa</TableHead><TableHead>Status</TableHead><TableHead>Nilai</TableHead><TableHead>Waktu</TableHead><TableHead>Pelanggaran</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.attempts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell><p className="font-medium">{a.students?.full_name}</p><p className="text-xs text-muted-foreground">{a.students?.username} · {a.students?.class_name}</p></TableCell>
                  <TableCell><Badge variant={a.status === "suspended" ? "destructive" : a.status === "submitted" ? "default" : "secondary"}>{statusLabel[a.status]}</Badge></TableCell>
                  <TableCell className="font-bold">{a.score != null ? <span className={Number(a.score) >= data.exam.kkm ? "text-success" : "text-destructive"}>{a.score}</span> : "-"}</TableCell>
                  <TableCell className="text-xs">{a.started_at ? <>{fmtDate(a.started_at)}<br />{a.submitted_at ? durationText(a.started_at, a.submitted_at) : "berlangsung"}</> : "-"}</TableCell>
                  <TableCell>{a.violation_count}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap text-right">
                    {a.status === "suspended" && <Button size="sm" onClick={() => verify(a.id)}><ShieldCheck className="h-4 w-4" /> Verifikasi</Button>}
                    {a.started_at && <Button size="sm" variant="outline" onClick={() => setDetail(a.id)}><Eye className="h-4 w-4" /> Detail</Button>}
                    <Button size="sm" variant="ghost" onClick={() => reset(a.id)}>Reset</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AttemptDetail attemptId={detail} onClose={() => setDetail(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["results", id] })} />
    </div>
  );
}

function AttemptDetail({ attemptId, onClose, onChanged }: { attemptId: string | null; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["attempt", attemptId],
    enabled: !!attemptId,
    queryFn: async () => {
      if (!attemptId) throw new Error("Pilih peserta.");
      const at = await supabase.from("attempts").select("question_order, score, students(full_name)").eq("id", attemptId).single();
      const ids = (at.data?.question_order as string[]) ?? [];
      const [qs, ans, vio] = await Promise.all([
        supabase.from("questions").select("id, type, prompt, options, media, option_media, answer, points").in("id", ids),
        supabase.from("answers").select("question_id, value, is_correct, points_awarded").eq("attempt_id", attemptId),
        supabase.from("violations").select("type, occurred_at").eq("attempt_id", attemptId).order("occurred_at"),
      ]);
      const byQ = new Map((qs.data ?? []).map((q) => [q.id, q]));
      const byA = new Map((ans.data ?? []).map((a) => [a.question_id, a]));
      return { att: at.data as any, items: ids.flatMap((i) => { const q = byQ.get(i); return q ? [{ q, a: byA.get(i) }] : []; }), vio: vio.data ?? [] };
    },
  });

  async function grade(qid: string, pts: number, max: number) {
    if (!attemptId) return;
    if (Number.isNaN(pts) || pts < 0 || pts > max) { toast.error(`Nilai 0–${max}`); return; }
    const { error } = await supabase.from("answers").update({ points_awarded: pts, is_correct: pts > 0 }).eq("attempt_id", attemptId).eq("question_id", qid);
    if (error) { toast.error("Siswa belum menjawab soal ini atau gagal menyimpan"); return; }
    await supabase.rpc("grade_attempt", { _attempt: attemptId });
    toast.success("Nilai uraian disimpan");
    qc.invalidateQueries({ queryKey: ["attempt", attemptId] });
    onChanged();
  }

  const show = (q: any, v: unknown) => {
    if (v == null) return <span className="text-muted-foreground">(kosong)</span>;
    if (q.type === "pg") return <><span>{String.fromCharCode(65 + Number(v))}. {(q.options as string[])[Number(v)] ?? ""}</span><QuestionMediaView media={parseMedia(q.option_media?.[Number(v)])} label="Media pilihan jawaban" /></>;
    if (q.type === "bs") return v ? "Benar" : "Salah";
    return String(v);
  };

  return (
    <Dialog open={!!attemptId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{data?.att?.students?.full_name} — Nilai {data?.att?.score ?? "-"}</DialogTitle></DialogHeader>
        {data && (
          <div className="space-y-4">
            {data.items.map(({ q, a }, i) => (
              <div key={q.id} className="rounded-xl border p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold">No. {i + 1} · {typeLabel[q.type]}</span>
                  <Badge variant={a?.is_correct ? "default" : "outline"}>{a?.points_awarded ?? 0} / {q.points}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{q.prompt}</p>
                <QuestionMediaView media={parseMedia(q.media)} label="Media pertanyaan" />
                <div className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-2"><span className="font-medium">Jawaban: </span>{show(q, a?.value)}</div>
                {q.type !== "uraian" && <div className="mt-1 text-xs text-muted-foreground">Kunci: {q.type === "isian" ? (q.answer as string[]).join(" / ") : show(q, q.answer)}</div>}
                {q.type === "uraian" && a && (
                  <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); grade(q.id, Number(new FormData(e.currentTarget).get("p")), q.points); }}>
                    <Input name="p" type="number" min={0} max={q.points} step="0.5" defaultValue={a.points_awarded ?? ""} className="w-24" />
                    <Button size="sm">Simpan nilai</Button>
                  </form>
                )}
              </div>
            ))}
            <div>
              <h3 className="mb-2 font-bold">Riwayat pelanggaran</h3>
              {data.vio.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada.</p> : (
                <ul className="space-y-1 text-sm">{data.vio.map((v, i) => <li key={i} className="font-mono text-xs">{new Date(v.occurred_at).toLocaleString("id-ID", { timeStyle: "medium", dateStyle: "short" })} — {violationLabel[v.type] ?? v.type}</li>)}</ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
