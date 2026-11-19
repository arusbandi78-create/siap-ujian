import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Settings, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDate, genCode } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/guru/ujian/")({ head: () => ({ meta: [{ title: "Manajemen Ujian — SiapUjian" }, { name: "description", content: "Kelola daftar ujian dan jadwal pengerjaan siswa." }, { property: "og:title", content: "Manajemen Ujian — SiapUjian" }, { property: "og:description", content: "Kelola daftar ujian dan jadwal pengerjaan siswa." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: UjianList });

function UjianList() {
  const navigate = useNavigate();
  const { data: list = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*, exam_questions(count), attempts(count)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function create() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Silakan masuk kembali."); return; }
    const { data, error } = await supabase
      .from("exams")
      .insert({ title: "Ujian Baru", code: genCode(), teacher_id: u.user.id, instructions: "Bacalah setiap soal dengan teliti. Jawaban tersimpan otomatis." })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/guru/ujian/$id", params: { id: data.id } });
  }

  return (
    <div>
      <PageHeader title="Manajemen Ujian" desc="Atur jadwal, durasi, soal, KKM, dan Exam Mode." action={<Button onClick={create}><Plus className="h-4 w-4" /> Ujian baru</Button>} />
      {list.length === 0 && <Empty>Belum ada ujian.</Empty>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((e: any) => (
          <div key={e.id} className="flex flex-col rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{e.title}</h3>
                <p className="text-sm text-muted-foreground">{e.subject || "—"}</p>
              </div>
              <Badge variant={e.is_active ? "default" : "secondary"} className="font-mono tracking-widest">{e.code}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Mulai</dt><dd>{fmtDate(e.start_at)}</dd>
              <dt className="text-muted-foreground">Durasi</dt><dd>{e.duration_minutes} menit</dd>
              <dt className="text-muted-foreground">Soal</dt><dd>{e.exam_questions?.[0]?.count ?? 0}</dd>
              <dt className="text-muted-foreground">Peserta</dt><dd>{e.attempts?.[0]?.count ?? 0}</dd>
            </dl>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1"><Link to="/guru/ujian/$id" params={{ id: e.id }}><Settings className="h-4 w-4" /> Atur</Link></Button>
              <Button asChild size="sm" className="flex-1"><Link to="/guru/hasil/$id" params={{ id: e.id }}><BarChart3 className="h-4 w-4" /> Hasil</Link></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
