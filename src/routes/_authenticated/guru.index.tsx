import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, Empty } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { fmtDate, violationLabel } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/guru/")({ head: () => ({ meta: [{ title: "Dashboard Guru — SiapUjian" }, { name: "description", content: "Ringkasan aktivitas ujian, siswa, dan nilai." }, { property: "og:title", content: "Dashboard Guru — SiapUjian" }, { property: "og:description", content: "Ringkasan aktivitas ujian, siswa, dan nilai." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [exams, qs, st, at, vio] = await Promise.all([
        supabase.from("exams").select("id, title, code, is_active, start_at, end_at").order("created_at", { ascending: false }),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("attempts").select("status, score"),
        supabase.from("violations").select("id, type, occurred_at, attempts(students(full_name)), exams(title)").order("occurred_at", { ascending: false }).limit(8),
      ]);
      const scores = (at.data ?? []).filter((a) => a.status === "submitted" && a.score != null).map((a) => Number(a.score));
      return {
        exams: exams.data ?? [],
        questions: qs.count ?? 0,
        students: st.count ?? 0,
        active: (at.data ?? []).filter((a) => a.status === "in_progress").length,
        suspended: (at.data ?? []).filter((a) => a.status === "suspended").length,
        avg: scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : "-",
        violations: vio.data ?? [],
      };
    },
  });

  return (
    <div>
      <PageHeader title="Dashboard" desc="Ringkasan aktivitas ujian Anda." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Ujian" value={data?.exams.length ?? "…"} />
        <StatCard label="Soal" value={data?.questions ?? "…"} />
        <StatCard label="Siswa" value={data?.students ?? "…"} />
        <StatCard label="Sedang mengerjakan" value={data?.active ?? "…"} hint={data?.suspended ? `${data.suspended} ditangguhkan` : undefined} />
        <StatCard label="Rata-rata nilai" value={data?.avg ?? "…"} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-bold">Ujian terbaru</h2>
          {data?.exams.length === 0 && <Empty>Belum ada ujian. <Link to="/guru/ujian" className="text-primary">Buat ujian</Link></Empty>}
          <ul className="divide-y">
            {data?.exams.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-3">
                <div>
                  <Link to="/guru/hasil/$id" params={{ id: e.id }} className="font-semibold hover:text-primary">{e.title}</Link>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.start_at)} – {fmtDate(e.end_at)}</p>
                </div>
                <Badge variant={e.is_active ? "default" : "secondary"}>{e.code}</Badge>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex justify-between"><h2 className="font-bold">Pelanggaran terbaru</h2><Link to="/guru/audit" className="text-sm text-primary">Lihat semua</Link></div>
          {data?.violations.length === 0 && <Empty>Belum ada pelanggaran tercatat.</Empty>}
          <ul className="divide-y">
            {data?.violations.map((v: any) => (
              <li key={v.id} className="py-3 text-sm">
                <span className="font-semibold">{v.attempts?.students?.full_name}</span> — {violationLabel[v.type] ?? v.type}
                <p className="text-xs text-muted-foreground">{v.exams?.title} · {fmtDate(v.occurred_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
