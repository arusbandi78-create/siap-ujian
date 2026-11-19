import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { typeLabel } from "@/lib/labels";
import { batches } from "@/lib/exam-rules";
import { downloadTemplate, parseWorkbook, templates, type ParsedRow, type QType } from "@/lib/question-import";

export const Route = createFileRoute("/_authenticated/guru/upload")({
  head: () => ({
    meta: [
      { title: "Upload Soal — SiapUjian" },
      { name: "description", content: "Unggah soal dari file Excel dan unduh template tiap jenis soal." },
      { property: "og:title", content: "Upload Soal — SiapUjian" },
      { property: "og:description", content: "Unggah soal dari file Excel dan unduh template tiap jenis soal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadSoal,
});

function UploadSoal() {
  const nav = useNavigate();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const valid = rows.filter((r) => !r.error);
  const invalid = rows.filter((r) => r.error);

  async function onFile(f?: File) {
    if (!f) return;
    if (busy) return;
    try {
      const r = await parseWorkbook(f);
      setRows(r);
      setSaved(0);
      setFileName(f.name);
      if (!r.length) toast.error("Tidak ada soal ditemukan. Pastikan memakai template.");
    } catch {
      toast.error("File tidak bisa dibaca. Gunakan file .xlsx dari template.");
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Silakan masuk kembali sebagai guru.");
      let completed = saved;
      for (const group of batches(valid.slice(saved))) {
        const payload = group.map((r) => ({ teacher_id: u.user.id, type: r.type, subject: r.subject, topic: r.topic, prompt: r.prompt, options: r.options, answer: r.answer as never, points: r.points }));
        const { error } = await supabase.from("questions").insert(payload);
        if (error) throw error;
        completed += group.length;
        setSaved(completed);
      }
      toast.success(`${valid.length} soal berhasil diunggah`);
      nav({ to: "/guru/soal" });
    } catch (error) { toast.error("Unggahan terhenti. Soal yang sudah tersimpan tidak diulang. Klik Simpan untuk melanjutkan. " + (error as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Upload Soal" desc="Unggah banyak soal sekaligus dari file Excel" />

      <section className="mb-6 rounded-2xl border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">1. Unduh template</h2>
            <p className="text-sm text-muted-foreground">Satu file berisi semua jenis soal, atau pilih per jenis.</p>
          </div>
          <Button onClick={() => downloadTemplate()}><Download className="h-4 w-4" /> Template lengkap</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(templates) as QType[]).map((t) => (
            <div key={t} className="flex flex-col rounded-xl border p-4">
              <div className="mb-1 flex items-center gap-2 font-medium"><FileSpreadsheet className="h-4 w-4 text-primary" />{typeLabel[t]}</div>
              <p className="mb-2 text-xs text-muted-foreground">Kolom: {templates[t].headers.join(", ")}</p>
              <p className="mb-3 flex-1 text-xs">{templates[t].note}</p>
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(t)}><Download className="h-4 w-4" /> Unduh</Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">2. Unggah file yang sudah diisi</h2>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-accent">
          <Upload className="h-6 w-6 text-primary" />
          <span className="text-sm">{fileName || "Klik untuk memilih file .xlsx"}</span>
          <input type="file" disabled={busy} accept=".xlsx,.xls" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </section>

      {rows.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">3. Periksa & simpan</h2>
            <div className="flex items-center gap-2">
              <Badge>{valid.length} siap</Badge>
              {rows.length > 200 && <p className="mt-2 text-xs text-muted-foreground">Menampilkan 200 baris pertama; seluruh soal valid tetap disimpan.</p>}
          {invalid.length > 0 && <Badge variant="destructive">{invalid.length} bermasalah</Badge>}
              <Button disabled={!valid.length || busy} onClick={save}>{busy ? `Menyimpan ${saved}/${valid.length}…` : `Simpan ${valid.length - saved} soal`}</Button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left"><tr><th className="p-2">Baris</th><th className="p-2">Jenis</th><th className="p-2">Soal</th><th className="p-2">Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.row}</td>
                    <td className="p-2 whitespace-nowrap">{typeLabel[r.type]}</td>
                    <td className="p-2">{r.prompt || "—"}</td>
                    <td className="p-2 whitespace-nowrap">{r.error ? <span className="text-destructive">{r.error}</span> : <span className="text-primary">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <p className="mt-2 text-xs text-muted-foreground">Menampilkan 200 baris pertama; seluruh soal valid tetap disimpan.</p>}
          {invalid.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Baris bermasalah tidak akan disimpan.</p>}
        </section>
      )}
    </div>
  );
}
