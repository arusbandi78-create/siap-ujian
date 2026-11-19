import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getResult } from "@/lib/exam.functions";
import { studentSession } from "@/lib/student-session";
import { fmtDate } from "@/lib/labels";

export const Route = createFileRoute("/selesai")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ujian Selesai — SiapUjian" },
      { name: "description", content: "Jawaban ujian telah terkirim." },
      { property: "og:title", content: "Ujian Selesai — SiapUjian" },
      { property: "og:description", content: "Jawaban ujian telah terkirim." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Selesai,
});

function Selesai() {
  const fRes = useServerFn(getResult);
  const [r, setR] = useState<Awaited<ReturnType<typeof getResult>> | null>(null);
  useEffect(() => {
    const t = studentSession.get();
    if (t) fRes({ data: { token: t } }).then(setR).catch(() => setR(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
        <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
        <h1 className="mt-4 text-2xl font-extrabold">Ujian Selesai</h1>
        <p className="mt-2 text-muted-foreground">Terima kasih{r ? `, ${r.student}` : ""}. Jawabanmu telah terkirim dengan aman.</p>
        {r && <p className="mt-1 text-sm text-muted-foreground">{r.title} · {fmtDate(r.submitted_at)}</p>}
        {r?.visible ? (
          <div className="mt-6 rounded-xl bg-secondary p-5">
            <p className="text-sm text-secondary-foreground">Nilai kamu</p>
            <p className="text-5xl font-extrabold text-primary">{r.score}</p>
            <p className={`mt-1 text-sm font-semibold ${r.passed ? "text-success" : "text-destructive"}`}>{r.passed ? "Tuntas" : "Belum tuntas"} (KKM {r.kkm})</p>
          </div>
        ) : (
          <p className="mt-6 rounded-xl bg-muted p-4 text-sm text-muted-foreground">Nilai akan diumumkan oleh guru.</p>
        )}
        <Button asChild className="mt-6 w-full" variant="outline">
          <Link to="/" onClick={() => studentSession.clear()}>Keluar</Link>
        </Button>
      </div>
    </div>
  );
}
