import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/guru/siswa")({ head: () => ({ meta: [{ title: "Peserta Ujian — SiapUjian" }, { name: "description", content: "Kelola identitas dan PIN peserta ujian." }, { property: "og:title", content: "Peserta Ujian — SiapUjian" }, { property: "og:description", content: "Kelola identitas dan PIN peserta ujian." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Siswa });

function Siswa() {
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", class_name: "" });
  const [bulk, setBulk] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  const { data: list = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
       const { data, error } = await supabase.from("students").select("id, full_name, class_name").order("class_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const usernameFromName = (name: string) => name
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);

  const add = async (s: typeof f & { _username?: string }) => {
    const username = s._username || usernameFromName(s.full_name) || s.full_name.slice(0, 3);
    const { error } = await supabase.rpc("create_student", {
      _username: "", _full_name: s.full_name, _class: s.class_name, _pin: "",
    });
    if (error) throw new Error(error.message);
  };

  const create = useMutation({
    mutationFn: () => add(f),
    onSuccess: () => { toast.success("Siswa ditambahkan"); setF({ full_name: "", class_name: f.class_name }); qc.invalidateQueries({ queryKey: ["students"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const importBulk = useMutation({
    mutationFn: async () => {
       const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 300);
       let ok = 0; const errs: string[] = [];
       for (const l of lines) {
       const [full_name, class_name] = l.split(/[,;\t]/).map((s) => s?.trim() ?? "");
       try { await add({ full_name: full_name ?? "", class_name: class_name ?? "" }); ok++; } catch (e) { errs.push(`${full_name}: ${(e as Error).message}`); }
       }
       return { ok, errs };
    },
    onSuccess: ({ ok, errs }) => { toast.success(`${ok} siswa diimpor`); if (errs.length) toast.error(errs.slice(0, 3).join("\n")); setBulk(""); qc.invalidateQueries({ queryKey: ["students"] }); },
  });

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nama Lengkap", "Kelas", "PIN"],
      ["Budi Santoso", "7A", "1234"],
      ["Siti Rahayu", "7B", "5678"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siswa");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-siswa.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (file: File) => {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("File Excel kosong");
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
    let ok = 0; const errs: string[] = [];
    for (let i = 1; i < rows.length && i < 301; i++) {
      const r = rows[i];
      if (!r || r.every((c) => c == null || c === "")) continue;
      const full_name = String(r[0] ?? "").trim();
      const class_name = String(r[1] ?? "").trim();
      const pin = String(r[2] ?? "").trim();
      if (!full_name) continue;
      try { await add({ full_name, class_name, pin }); ok++; } catch (e) { errs.push(`${full_name}: ${(e as Error).message}`); }
    }
    toast.success(`${ok} siswa diimpor`);
    if (errs.length) toast.error(errs.slice(0, 3).join("\n"));
    setImportFile(null);
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  async function remove(id: string) {
    if (!confirm("Hapus siswa beserta riwayat ujiannya?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    error ? toast.error(error.message) : qc.invalidateQueries({ queryKey: ["students"] });
  }

  return (
    <div>
      <PageHeader title="Siswa" desc="Akun siswa untuk masuk ujian (nama lengkap). Semua siswa Anda dapat mengikuti ujian Anda dengan kode ujian." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <form className="space-y-3 rounded-2xl border bg-card p-5" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <h2 className="font-bold">Tambah siswa</h2>
            <Input placeholder="Nama lengkap" value={f.full_name} maxLength={120} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
            <Input placeholder="Kelas" value={f.class_name} maxLength={40} onChange={(e) => setF({ ...f, class_name: e.target.value })} />
            <Button className="w-full" disabled={create.isPending}>Simpan</Button>
          </form>
          <div className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="font-bold">Impor cepat</h2>
            <p className="text-xs text-muted-foreground">Satu baris per siswa: nama, kelas</p>
            <Textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Budi Santoso, 7A, 1234"} />
            <div className="flex gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4" /> Unduh Template Excel</Button>
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileImport(e.target.files[0]); }} />
              <Button variant="outline" size="sm" onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement | null)?.click()}><Upload className="h-4 w-4" /> Unggah Excel</Button>
            </div>
            <Button variant="outline" className="w-full" disabled={!bulk.trim() || importBulk.isPending} onClick={() => importBulk.mutate()}><Upload className="h-4 w-4" /> Impor Teks</Button>
          </div>
        </div>
        <div className="lg:col-span-2">
          {list.length === 0 ? <Empty>Belum ada siswa.</Empty> : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <Table>
            <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Kelas</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>{s.class_name}</TableCell>
                      <TableCell className="text-right">
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
