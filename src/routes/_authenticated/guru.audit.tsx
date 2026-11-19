import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader, Empty } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { violationLabel, statusLabel } from "@/lib/labels";
import { readAllRows } from "@/lib/exam-rules";
import { filterIncidents, type Incident } from "@/lib/incident-history";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/guru/audit")({ head: () => ({ meta: [{ title: "Audit Pelanggaran — SiapUjian" }, { name: "description", content: "Pantau aktivitas keluar dan pelanggaran ujian siswa." }, { property: "og:title", content: "Audit Pelanggaran — SiapUjian" }, { property: "og:description", content: "Pantau aktivitas keluar dan pelanggaran ujian siswa." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Audit });

function Audit() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [resuming, setResuming] = useState<string | null>(null);
  const { data = [], isPending, isError } = useQuery({
    queryKey: ["audit"],
    refetchInterval: 15000,
    queryFn: () => readAllRows<Incident>(async (from, to) => {
      const { data, error } = await supabase
        .from("violations")
        .select("id, type, occurred_at, exams(title, code), attempts(id, exam_id, violation_count, status, deadline_at, students(full_name, username, class_name))")
        .order("occurred_at", { ascending: false }).order("id")
        .range(from, to);
      return { data, error };
    }),
  });
  const shown = filterIncidents(data, q, type, status);

  async function resumeAttempt(attemptId: string, examId: string) {
    setResuming(attemptId);
    const { error } = await supabase
      .from("attempts")
      .update({ status: "in_progress" })
      .eq("id", attemptId)
      .eq("exam_id", examId);
    setResuming(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ujian berhasil diizinkan lanjut kembali");
    qc.invalidateQueries({ queryKey: ["audit"] });
  }

  return (
    <div>
      <PageHeader title="Riwayat Insiden Ujian" desc={`${shown.length} insiden · Waktu perangkat guru (${Intl.DateTimeFormat().resolvedOptions().timeZone})`} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input aria-label="Cari insiden" className="w-full sm:w-72" placeholder="Cari siswa, kelas, ujian…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={type} onValueChange={setType}><SelectTrigger aria-label="Jenis pelanggaran" className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua jenis pelanggaran</SelectItem>{Object.entries(violationLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Status ujian" className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      </div>
      {isPending ? <Empty>Memuat riwayat insiden…</Empty> : isError ? <Empty>Riwayat belum dapat dimuat. Coba lagi saat koneksi pulih.</Empty> : shown.length === 0 ? <Empty>Tidak ada catatan pelanggaran.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Siswa</TableHead><TableHead>Ujian</TableHead><TableHead>Jenis pelanggaran</TableHead><TableHead>Status ujian</TableHead><TableHead className="w-32">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {shown.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{new Date(v.occurred_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" })}</TableCell>
                  <TableCell><p className="font-medium">{v.attempts?.students?.full_name}</p><p className="text-xs text-muted-foreground">{v.attempts?.students?.class_name}</p></TableCell>
                  <TableCell>{v.exams?.title}<p className="text-xs text-muted-foreground">{v.exams?.code}</p></TableCell>
                  <TableCell><Badge variant="outline">{violationLabel[v.type] ?? v.type}</Badge></TableCell>
                  <TableCell><Badge variant={v.attempts?.status === "suspended" ? "destructive" : "secondary"}>{statusLabel[v.attempts?.status ?? ""] ?? "—"}</Badge></TableCell>
                  <TableCell>
                    {v.attempts?.status === "suspended" && v.attempts ? (
                      <Button size="sm" onClick={() => resumeAttempt(v.attempts!.id, v.attempts!.exam_id)} disabled={resuming === v.attempts!.id}>
                        <RefreshCw className="h-4 w-4" /> {resuming === v.attempts!.id ? "Memproses…" : "Lanjutkan"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
