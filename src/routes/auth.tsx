import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk Guru — SiapUjian" },
      { name: "description", content: "Masuk atau daftar sebagai guru untuk mengelola ujian." },
      { property: "og:title", content: "Masuk Guru — SiapUjian" },
      { property: "og:description", content: "Masuk atau daftar sebagai guru untuk mengelola ujian." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Email tidak valid").max(255),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ email: "", password: "", name: "" });

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(p.data);
    setLoading(false);
    if (error) { toast.error("Email atau kata sandi salah, atau email belum dikonfirmasi."); return; }
    navigate({ to: "/guru" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    if (f.name.trim().length < 2) { toast.error("Nama wajib diisi"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      ...p.data,
      options: { emailRedirectTo: window.location.origin + "/guru", data: { full_name: f.name.trim().slice(0, 120) } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) navigate({ to: "/guru" });
    else toast.success("Pendaftaran berhasil. Cek email untuk konfirmasi akun.");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="mb-6"><Brand /></Link>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-soft">
        <Tabs defaultValue="in">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">Masuk</TabsTrigger>
            <TabsTrigger value="up">Daftar Guru</TabsTrigger>
          </TabsList>
          <TabsContent value="in">
            <form onSubmit={signIn} className="mt-4 space-y-4">
              <Fields f={f} setF={setF} />
              <Button className="w-full" disabled={loading}>{loading ? "Memproses..." : "Masuk"}</Button>
            </form>
          </TabsContent>
          <TabsContent value="up">
            <form onSubmit={signUp} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama lengkap</Label>
                <Input id="name" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <Fields f={f} setF={setF} />
              <Button className="w-full" disabled={loading}>{loading ? "Memproses..." : "Daftar"}</Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
      <Link to="/" className="mt-4 text-sm text-muted-foreground hover:text-primary">Saya siswa → Masuk ujian</Link>
    </div>
  );
}

function Fields({ f, setF }: { f: { email: string; password: string; name: string }; setF: (v: typeof f) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Kata sandi</Label>
        <Input id="password" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </div>
    </>
  );
}
