import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, Lock, User, GraduationCap } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { studentLogin } from "@/lib/exam.functions";
import { studentSession } from "@/lib/student-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Masuk Ujian — SiapUjian" },
      { name: "description", content: "Masuk ujian digital dengan kode ujian, username, dan PIN." },
      { property: "og:title", content: "Masuk Ujian — SiapUjian" },
      { property: "og:description", content: "Masuk ujian digital dengan kode ujian, username, dan PIN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentLogin,
});

const schema = z.object({
  code: z.string().trim().min(4, "Kode ujian minimal 4 karakter").max(12),
  username: z.string().trim().min(3, "Username minimal 3 karakter").max(40),
  pin: z.string().regex(/^[0-9]{4,8}$/, "PIN 4–8 digit angka"),
});

function StudentLogin() {
  const login = useServerFn(studentLogin);
  const navigate = useNavigate();
  const [form, setForm] = useState({ code: "", username: "", pin: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setLoading(true);
    try {
      const res = await login({ data: parsed.data });
      if (!res.ok) { toast.error(res.message); return; }
      studentSession.set(res.token);
      navigate({ to: "/ujian" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Brand />
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">
            <GraduationCap className="h-4 w-4" /> Masuk Guru
          </Link>
        </Button>
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-8 md:grid-cols-2 md:py-16">
        <div className="space-y-4">
          <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            Asesmen digital yang aman
          </span>
          <h1 className="text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
            Kerjakan ujian dengan <span className="text-primary">tenang dan jujur.</span>
          </h1>
          <p className="max-w-md text-muted-foreground">
            Jawaban tersimpan otomatis, timer mengikuti waktu server, dan mode ujian membantu menjaga fokusmu.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-soft md:p-8">
          <div>
            <h2 className="text-xl font-bold">Masuk Siswa</h2>
            <p className="text-sm text-muted-foreground">Gunakan data dari gurumu.</p>
          </div>
          <Field icon={<KeyRound className="h-4 w-4" />} label="Kode Ujian" id="code">
            <Input id="code" autoComplete="off" className="pl-9 uppercase tracking-widest" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="MTK7A2" />
          </Field>
          <Field icon={<User className="h-4 w-4" />} label="Username" id="username">
            <Input id="username" autoComplete="username" className="pl-9" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="budi.s" />
          </Field>
          <Field icon={<Lock className="h-4 w-4" />} label="PIN" id="pin">
            <Input id="pin" type="password" inputMode="numeric" maxLength={8} className="pl-9" value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} placeholder="••••" />
          </Field>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Memeriksa..." : "Masuk Ujian"}
          </Button>
        </form>
      </main>
    </div>
  );
}

function Field({ icon, label, id, children }: { icon: React.ReactNode; label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}
