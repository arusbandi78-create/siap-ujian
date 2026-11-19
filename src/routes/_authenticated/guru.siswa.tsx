import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/guru/siswa")({ head: () => ({ meta: [{ title: "Peserta Ujian — SiapUjian" }, { name: "description", content: "Kelola identitas dan PIN peserta ujian." }, { property: "og:title", content: "Peserta Ujian — SiapUjian" }, { property: "og:description", content: "Kelola identitas dan PIN peserta ujian." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Siswa });

function Siswa() {
  const qc = useQueryClient();
  const [f, setF] = useState({ username: "", full_name: "", class_name: "", pin: "" });
  const [bulk, setBulk] = useState("");

  const { data: list = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, username, full_name, class_name").order("class_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const add = async (s: typeof f) => {
    const { error } = await supabase.rpc("create_student", {
      _username: s.username.trim().toLowerCase(), _full_name: s.full_name, _class: s.class_name, _pin: s.pin,
    });
    if (error) throw new Error(error.message.includes("duplicate") ? `Username ${s.username} sudah dipakai` : error.message);
  };

  const create = useMutation({
    mutationFn: () => add(f),
    onSuccess: () => { toast.success("Siswa ditambahkan"); setF({ username: "", full_name: "", class_name: f.class_name, pin: "" }); qc.invalidateQueries({ queryKey: ["students"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const importBulk = useMutation({
    mutationFn: async () => {
      const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 300);
      let ok = 0; const errs: string[] = [];
      for (const l of lines) {
        const [username, full_name, class_name, pin] = l.split(/[,;\t]/).map((s) => s?.trim() ?? "");
        try { await add({ username: username ?? "", full_name: full_name ?? "", class_name: class_name ?? "", pin: pin ?? "" }); ok++; } catch (e) { errs.push(`${username}: ${(e as Error).message}`); }
      }
      return { ok, errs };
    },
    onSuccess: ({ ok, errs }) => { toast.success(`${ok} siswa diimpor`); if (errs.length) toast.error(errs.slice(0, 3).join("\n")); setBulk(""); qc.invalidateQueries({ queryKey: ["students"] }); },
  });

  async function resetPin(id: string) {
    const pin = prompt("PIN baru (4–8 digit angka):");
    if (!pin) return;
    const { error } = await supabase.rpc("reset_student_pin", { _id: id, _pin: pin });
    error ? toast.error(error.message) : toast.success("PIN diperbarui");
  }
  async function remove(id: string) {
    if (!confirm("Hapus siswa beserta riwayat ujiannya?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    error ? toast.error(error.message) : qc.invalidateQueries({ queryKey: ["students"] });
  }

  return (
    <div>
      <PageHeader title="Siswa" desc="Akun siswa untuk masuk ujian (username + PIN). Semua siswa Anda dapat mengikuti ujian Anda dengan kode ujian." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <form className="space-y-3 rounded-2xl border bg-card p-5" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <h2 className="font-bold">Tambah siswa</h2>
            <Input placeholder="Nama lengkap" value={f.full_name} maxLength={120} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
            <Input placeholder="Username (huruf kecil, angka, . _ -)" value={f.username} maxLength={40} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Kelas" value={f.class_name} maxLength={40} onChange={(e) => setF({ ...f, class_name: e.target.value })} />
              <Input placeholder="PIN" inputMode="numeric" maxLength={8} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "") })} />
            </div>
            <Button className="w-full" disabled={create.isPending}>Simpan</Button>
          </form>
          <div className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="font-bold">Impor cepat</h2>
            <p className="text-xs text-muted-foreground">Satu baris per siswa: username, nama, kelas, PIN</p>
            <Textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"budi.s, Budi Santoso, 7A, 1234"} />
            <Button variant="outline" className="w-full" disabled={!bulk.trim() || importBulk.isPending} onClick={() => importBulk.mutate()}><Upload className="h-4 w-4" /> Impor</Button>
          </div>
        </div>
        <div className="lg:col-span-2">
          {list.length === 0 ? <Empty>Belum ada siswa.</Empty> : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Username</TableHead><TableHead>Kelas</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {list.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>{s.username}</TableCell>
                      <TableCell>{s.class_name}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" aria-label="Reset PIN" onClick={() => resetPin(s.id)}><KeyRound className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Hapus" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
