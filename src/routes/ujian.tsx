import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, Flag, ChevronLeft, ChevronRight, ShieldAlert, WifiOff, Maximize, Send } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getExamInfo, logViolation, saveAnswers, startExam, submitExam } from "@/lib/exam.functions";
import { studentSession, backupKey, examCacheKey, pendingSubmitKey, clearExamCache, exitLockKey, activeExamKey } from "@/lib/student-session";
import { OfflineHelp, SyncStatus } from "@/components/OfflineHelp";
import { useExamGuard, enterFullscreen, exitFullscreen, type ViolationType } from "@/hooks/use-exam-guard";
import { batches } from "@/lib/exam-rules";
import { fmtDate } from "@/lib/labels";
import { prepareExamAlarm, playExamAlarm, stopExamAlarm, releaseExamAlarm } from "@/lib/exam-alarm";
import { VolumeX } from "lucide-react";
import { QuestionMediaView } from "@/components/QuestionMedia";

export const Route = createFileRoute("/ujian")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ujian Berlangsung — SiapUjian" },
      { name: "description", content: "Halaman pengerjaan ujian siswa." },
      { property: "og:title", content: "Ujian — SiapUjian" },
      { property: "og:description", content: "Halaman pengerjaan ujian siswa." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UjianPage,
});

type Info = Awaited<ReturnType<typeof getExamInfo>>;
type StartRes = Awaited<ReturnType<typeof startExam>>;
type Started = Extract<StartRes, { status: "in_progress" }>;
type Val = number | boolean | string | null;
type Ans = Record<string, { value: Val; flagged: boolean }>;

type Cached = { info: Info; exam: Started; offset: number };

const isNetworkError = (e: unknown) =>
  !navigator.onLine || e instanceof TypeError || /fetch|network|failed to/i.test((e as Error)?.message ?? "");

function readCache(token: string): Cached | null {
  try { return JSON.parse(localStorage.getItem(examCacheKey(token)) ?? "null") as Cached | null; } catch { return null; }
}

function UjianPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [phase, setPhase] = useState<"loading" | "instructions" | "exam" | "suspended" | "offline">("loading");
  const [exam, setExam] = useState<Started | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const fInfo = useServerFn(getExamInfo);
  const fStart = useServerFn(startExam);

  useEffect(() => () => releaseExamAlarm(), []);

  const load = useCallback((t: string) => {
    setPhase("loading");
    fInfo({ data: { token: t } })
      .then((i) => {
        setInfo(i);
        setOfflineMode(false);
        if (i.status === "submitted") { clearExamCache(t); navigate({ to: "/selesai" }); }
        else if (i.status === "suspended") setPhase("suspended");
        else if (localStorage.getItem(exitLockKey(t))) {
          const version = Number(localStorage.getItem(exitLockKey(t)));
          if (i.resume_version > version) { localStorage.removeItem(exitLockKey(t)); localStorage.removeItem(activeExamKey(t)); setPhase("instructions"); }
          else { void logViolation({ data: { token: t, type: "page_exit", version } }); setPhase("suspended"); }
        }
        else setPhase("instructions");
      })
      .catch((e) => {
        if (isNetworkError(e)) {
          const c = readCache(t);
          if (c) {
            setInfo(c.info); setOfflineMode(true);
            if (localStorage.getItem(exitLockKey(t)) || localStorage.getItem(activeExamKey(t))) {
              localStorage.setItem(exitLockKey(t), String(c.exam.resume_version));
              setPhase("suspended");
            } else setPhase("instructions");
          }
          else setPhase("offline");
          return;
        }
        toast.error((e as Error).message); studentSession.clear(); navigate({ to: "/" });
      });
  }, [fInfo, navigate]);

  useEffect(() => {
    const t = studentSession.get();
    if (!t) { navigate({ to: "/" }); return; }
    setToken(t);
    load(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resumeFromCache = useCallback((t: string) => {
    const c = readCache(t);
    if (!c || localStorage.getItem(exitLockKey(t)) || localStorage.getItem(activeExamKey(t))) return false;
    // Rebuild server clock from the saved offset so the timer stays accurate offline.
    setExam({ ...c.exam, serverNow: new Date(Date.now() + c.offset).toISOString() } as Started);
    setOfflineMode(true);
    setPhase("exam");
    return true;
  }, []);

  const begin = useCallback(async () => {
    if (!token) return;
    stopExamAlarm();
    prepareExamAlarm();
    if (info?.exam.require_fullscreen) {
      const ok = await enterFullscreen();
      if (!ok) { toast.error("Layar penuh wajib untuk memulai. Gunakan browser yang mendukung atau hubungi guru."); return; }
    }
    if (offlineMode && !navigator.onLine && resumeFromCache(token)) return;
    try {
      const r = await fStart({ data: { token } });
      if (r.status === "submitted") { clearExamCache(token); return navigate({ to: "/selesai" }); }
      if (r.status === "suspended") return setPhase("suspended");
      const started = r as Started;
      localStorage.removeItem(exitLockKey(token));
      if (info) {
        const offset = new Date(started.serverNow).getTime() - Date.now();
        localStorage.setItem(examCacheKey(token), JSON.stringify({ info: { ...info, status: "in_progress" }, exam: started, offset } satisfies Cached));
      }
      setExam(started);
      setOfflineMode(false);
      setPhase("exam");
    } catch (e) {
      if (isNetworkError(e) && resumeFromCache(token)) { toast.info("Koneksi terputus. Ujian dibuka dari data yang tersimpan di perangkat."); return; }
      await exitFullscreen();
      toast.error(isNetworkError(e) ? "Tidak ada koneksi internet. Sambungkan internet lalu coba lagi." : (e as Error).message);
    }
  }, [token, info, fStart, navigate, offlineMode, resumeFromCache]);

  // Suspended: poll until teacher verifies
  useEffect(() => {
    if (phase !== "suspended" || !token) return;
    const iv = setInterval(async () => {
      try {
        const i = await fInfo({ data: { token } });
        if (i.status === "in_progress" && (!localStorage.getItem(exitLockKey(token)) || i.resume_version > Number(localStorage.getItem(exitLockKey(token))))) { localStorage.removeItem(exitLockKey(token)); localStorage.removeItem(activeExamKey(token)); setInfo(i); setPhase("instructions"); toast.success("Guru telah memverifikasi. Silakan lanjutkan ujian."); }
        if (i.status === "in_progress" && localStorage.getItem(exitLockKey(token)) && i.resume_version <= Number(localStorage.getItem(exitLockKey(token)))) {
          await logViolation({ data: { token, type: "page_exit", version: Number(localStorage.getItem(exitLockKey(token))) } });
        }
        if (i.status === "submitted") navigate({ to: "/selesai" });
      } catch { /* retry */ }
    }, 8000);
    return () => clearInterval(iv);
  }, [phase, token, fInfo, navigate]);

  if (phase === "offline")
    return (
      <Center>
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
          <WifiOff className="mx-auto h-14 w-14 text-destructive" />
          <h1 className="mt-4 text-2xl font-extrabold">Tidak Ada Koneksi</h1>
          <p className="mt-2 text-muted-foreground">Ujian belum pernah dibuka di perangkat ini, jadi soal belum tersimpan. Sambungkan internet (Wi-Fi atau data seluler), lalu coba lagi.</p>
          <Button className="mt-6 w-full" onClick={() => token && load(token)}>Coba Lagi</Button>
          <div className="mt-4 text-left"><OfflineHelp /></div>
        </div>
      </Center>
    );

  if (phase === "loading" || !info) return <Center><p className="text-muted-foreground">Memuat ujian…</p></Center>;

  if (phase === "suspended")
    return (
      <Center>
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
          <ShieldAlert className="mx-auto h-14 w-14 text-destructive" />
          <h1 className="mt-4 text-2xl font-extrabold">Ujian Ditangguhkan</h1>
          <p className="mt-2 text-muted-foreground">Aktivitas keluar atau pembukaan ulang ujian terdeteksi. Jawabanmu tetap aman tersimpan. Hubungi guru/pengawas untuk verifikasi agar dapat melanjutkan.</p>
          <p className="mt-4 text-xs text-muted-foreground">Halaman ini akan otomatis berlanjut setelah diverifikasi.</p>
          <Button variant="outline" className="mt-4" onClick={stopExamAlarm}><VolumeX className="h-4 w-4" /> Hentikan sirine</Button>
        </div>
      </Center>
    );

  if (phase === "exam" && exam && token)
    return <ExamRunner token={token} exam={exam} onSuspended={() => { setPhase("suspended"); exitFullscreen(); }} onDone={() => { exitFullscreen(); navigate({ to: "/selesai" }); }} />;

  const now = Date.now();
  const notYet = now < new Date(info.exam.start_at).getTime();
  const resumed = info.status === "in_progress";
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5"><Brand /><span className="text-sm text-muted-foreground">{info.student.full_name} · {info.student.class_name}</span></header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl border bg-card p-6 shadow-soft md:p-8">
          <p className="text-sm font-semibold text-primary">{info.exam.subject}</p>
          <h1 className="text-2xl font-extrabold md:text-3xl">{info.exam.title}</h1>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Fact k="Jumlah soal" v={info.total_questions} />
            <Fact k="Durasi" v={`${info.exam.duration_minutes} menit`} />
            <Fact k="KKM" v={info.exam.kkm} />
            <Fact k="Jika keluar" v="Izin guru wajib" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Jadwal: {fmtDate(info.exam.start_at)} – {fmtDate(info.exam.end_at)}</p>
          <h2 className="mt-6 font-bold">Instruksi</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{info.exam.instructions || "Kerjakan dengan jujur."}</p>
          <ul className="mt-4 space-y-1.5 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
            <li>• Ujian berjalan dalam mode layar penuh. Jangan berpindah tab, aplikasi, atau jendela.</li>
            <li>• Keluar, pindah tab/aplikasi, menutup, atau memuat ulang ujian langsung menangguhkan pengerjaan sampai guru memberi izin.</li>
            <li>• Jawaban tersimpan otomatis, juga saat koneksi terputus.</li>
            <li>• Saat waktu habis, jawaban dikirim otomatis.</li>
            <li>• Aplikasi tidak menggunakan kamera, mikrofon, atau data pribadi lain.</li>
          </ul>
          {offlineMode && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning bg-warning/10 p-3 text-sm">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> Kamu sedang offline. Ujian dibuka dari data yang tersimpan di perangkat ini. Jawaban akan dikirim otomatis saat internet kembali.
            </p>
          )}
          <div className="mt-4"><OfflineHelp /></div>
          <Button size="lg" className="mt-6 w-full" disabled={notYet} onClick={begin}>
            <Maximize className="h-4 w-4" /> {notYet ? "Ujian belum dimulai" : resumed ? "Lanjutkan Ujian" : "Mulai Ujian"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">Catatan: browser tidak dapat mengunci perangkat sepenuhnya. Sekolah dapat memakai mode kiosk/perangkat terkelola untuk penguncian penuh.</p>
        </div>
      </main>
    </div>
  );
}

function ExamRunner({ token, exam, onSuspended, onDone }: { token: string; exam: Started; onSuspended: () => void; onDone: () => void }) {
  const fSave = useServerFn(saveAnswers);
  const fViolation = useServerFn(logViolation);
  const fSubmit = useServerFn(submitExam);
  const bk = backupKey(token);
  const allKey = bk + "_all";

  const [answers, setAnswers] = useState<Ans>(() => {
    const a: Ans = {};
    exam.answers.forEach((x) => (a[x.question_id] = { value: x.value as Val, flagged: x.flagged }));
    try {
      Object.assign(a, JSON.parse(localStorage.getItem(allKey) ?? "{}") as Ans);
      Object.assign(a, JSON.parse(localStorage.getItem(bk) ?? "{}") as Ans);
    } catch { /* ignore */ }
    return a;
  });
  const dirty = useRef<Set<string>>(new Set(Object.keys(JSON.parse(localStorage.getItem(bk) ?? "{}"))));
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === exam.questions.length) setSelected(new Set());
    else setSelected(new Set(exam.questions.map((x) => x.id)));
  };
  const isSelectAll = exam.questions.length > 0 && selected.size === exam.questions.length;

  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(dirty.current.size);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [waitingSubmit, setWaitingSubmit] = useState(() => localStorage.getItem(pendingSubmitKey(token)) === "1");
  const offset = useRef(new Date(exam.serverNow).getTime() - Date.now());
  const deadline = new Date(exam.deadline_at).getTime();
  const [remaining, setRemaining] = useState(deadline - (Date.now() + offset.current));
  const finished = useRef(false);
  const locked = useRef(false);
  const inFlight = useRef(false);

  const finish = useCallback(() => {
    finished.current = true;
    clearExamCache(token);
    localStorage.removeItem(allKey);
    onDone();
  }, [token, allKey, onDone]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (locked.current) return false;
    if (dirty.current.size === 0) return true;
    if (inFlight.current) return false;
    inFlight.current = true;
    setSyncing(true);
    const ids = [...dirty.current];
    const payload = ids.map((id) => ({ question_id: id, value: answers[id]?.value ?? null, flagged: answers[id]?.flagged ?? false }));
    try {
      let r: Awaited<ReturnType<typeof saveAnswers>> | undefined;
      for (const group of batches(payload)) {
        r = await fSave({ data: { token, answers: group } });
        if (r.status === "suspended") { onSuspended(); return false; }
        if (r.status === "submitted") { if (!finished.current) finish(); return false; }
      }
      if (!r) return true;
      ids.forEach((id) => { if (JSON.stringify(answers[id]) === JSON.stringify(answersRef.current[id])) dirty.current.delete(id); });
      const rest: Ans = {};
      dirty.current.forEach((id) => { const v = answersRef.current[id]; if (v) rest[id] = v; });
      localStorage.setItem(bk, JSON.stringify(rest));
      setPending(dirty.current.size);
      setOnline(true);
      setSavedAt(new Date());
      return true;
    } catch {
      setOnline(false);
      return false;
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [answers, fSave, token, bk, onSuspended, finish]);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  const doSubmit = useCallback(async () => {
    if (finished.current || locked.current) return;
    setSubmitting(true);
    localStorage.setItem(pendingSubmitKey(token), "1");
    setWaitingSubmit(true);
    for (let i = 0; i < 3; i++) {
      try {
        const ok = await flush();
        if (!ok) throw new TypeError("network");
        await fSubmit({ data: { token } });
        finish();
        return;
      } catch (e) {
        if (i === 2 || !navigator.onLine) {
          if (!(e instanceof TypeError) && navigator.onLine) toast.error((e as Error).message);
          else toast.info("Belum ada koneksi. Jawaban aman di perangkat dan akan dikirim otomatis saat internet kembali.");
          setSubmitting(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }, [flush, fSubmit, token, finish]);

  // debounce save on change + periodic save (also retries pending submit)
  useEffect(() => { const t = setTimeout(() => void flush(), 1200); return () => clearTimeout(t); }, [answers, flush]);
  useEffect(() => {
    const iv = setInterval(() => { if (waitingSubmit && !submitting) void doSubmit(); else void flush(); }, 15000);
    return () => clearInterval(iv);
  }, [flush, doSubmit, waitingSubmit, submitting]);
  useEffect(() => {
    const on = () => { setOnline(true); toast.success("Koneksi pulih. Mengirim jawaban…"); if (waitingSubmit) void doSubmit(); else void flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [flush, doSubmit, waitingSubmit]);

  // timer
  useEffect(() => {
    const iv = setInterval(() => {
      const r = deadline - (Date.now() + offset.current);
      setRemaining(r);
      if (r <= 0 && !finished.current) { clearInterval(iv); toast.info("Waktu habis. Jawaban dikirim otomatis."); void doSubmit(); }
    }, 1000);
    return () => clearInterval(iv);
  }, [deadline, doSubmit]);

  const handleViolation = useCallback((type: ViolationType) => {
    if (finished.current || locked.current) return;
    locked.current = true;
    playExamAlarm();
    localStorage.setItem(exitLockKey(token), String(exam.resume_version));
    localStorage.setItem(allKey, JSON.stringify(answersRef.current));
    localStorage.setItem(bk, JSON.stringify(Object.fromEntries([...dirty.current].map((id) => [id, answersRef.current[id]]))));
    // Keepalive survives page close; the endpoint verifies the attempt token.
    void fetch("/api/public/exam-exit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ type, version: exam.resume_version }), keepalive: true }).catch(() => {});
    void fViolation({ data: { token, type, version: exam.resume_version } }).catch(() => {});
    onSuspended();
  }, [fViolation, token, onSuspended, exam.resume_version, allKey, bk]);

  useEffect(() => {
    localStorage.setItem(activeExamKey(token), String(exam.resume_version));
    return () => { if (finished.current) localStorage.removeItem(activeExamKey(token)); };
  }, [token, exam.resume_version]);

  useExamGuard(!finished.current, handleViolation, exam.exam.require_fullscreen);

  const q = exam.questions[idx] ?? exam.questions[0];
  const set = (value: Val) => { if (waitingSubmit || !q || locked.current) return; dirty.current.add(q.id); setAnswers((a) => ({ ...a, [q.id]: { value, flagged: a[q.id]?.flagged ?? false } })); };
  const toggleFlag = () => { if (waitingSubmit || !q || locked.current) return; dirty.current.add(q.id); setAnswers((a) => ({ ...a, [q.id]: { value: a[q.id]?.value ?? null, flagged: !a[q.id]?.flagged } })); };
  useEffect(() => {
    localStorage.setItem(bk, JSON.stringify(Object.fromEntries([...dirty.current].map((id) => [id, answers[id]]))));
    localStorage.setItem(allKey, JSON.stringify(answers));
    setPending(dirty.current.size);
  }, [answers, bk, allKey]);

  if (!q) return <Center><p>Soal tidak tersedia. Hubungi guru.</p></Center>;

  const isAnswered = (id: string) => { const v = answers[id]?.value; return v !== null && v !== undefined && v !== ""; };
  const unanswered = exam.questions.filter((x) => !isAnswered(x.id)).length;
  const mm = Math.max(0, Math.floor(remaining / 60000));
  const ss = Math.max(0, Math.floor((remaining % 60000) / 1000));
  const low = remaining < 5 * 60000;

  return (
    <div className="exam-lock min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0"><p className="truncate font-bold">{exam.exam.title}</p><SyncStatus online={online} syncing={syncing} pending={pending} savedAt={savedAt} /></div>
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-lg font-bold ${low ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"}`}><Clock className="h-4 w-4" />{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</div>
        </div>
        {(!online || waitingSubmit) && (
          <div className="border-t border-warning bg-warning/15 px-4 py-2.5 text-sm">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
              <p className="flex items-start gap-2">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {waitingSubmit
                    ? <><b>Jawaban siap dikirim.</b> Menunggu koneksi internet — jangan tutup aplikasi dan jangan hapus data browser.</>
                    : <><b>Koneksi terputus.</b> Tetap kerjakan soal — jawabanmu disimpan di perangkat dan dikirim otomatis saat internet kembali.</>}
                </span>
              </p>
              <OfflineHelp compact />
            </div>
          </div>
        )}
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border bg-card p-5 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} aria-label={`Pilih soal ${idx + 1}`} />
              <span className="text-sm font-semibold text-primary">Soal {idx + 1} dari {exam.questions.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={isSelectAll ? "default" : "outline"} onClick={toggleSelectAll} disabled={exam.questions.length === 0}>{isSelectAll ? "Pilih Tidak Semua" : "Pilih Semua"}</Button>
              <Button variant={answers[q.id]?.flagged ? "default" : "outline"} size="sm" onClick={toggleFlag}><Flag className="h-4 w-4" /> Ragu-ragu</Button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-lg leading-relaxed">{q.prompt}</p>
          <QuestionMediaView media={q.media} label={`Media soal ${idx + 1}`} exam />
          <div className="mt-6 space-y-3">
            {q.type === "pg" && q.options.map((o, k) => {
              const sel = answers[q.id]?.value === o.i;
              return (
                <div key={o.i} className={`min-w-0 rounded-lg border p-4 ${sel ? "border-primary bg-accent" : "bg-card"}`}>
                  <Button variant="ghost" className="h-auto min-h-10 w-full justify-start whitespace-normal text-left" disabled={waitingSubmit} onClick={() => set(o.i)} aria-label={`Pilih jawaban ${String.fromCharCode(65 + k)}`} aria-pressed={sel}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${sel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{String.fromCharCode(65 + k)}</span>
                    <span className="min-w-0 break-words">{o.text || `Pilihan ${String.fromCharCode(65 + k)}`}</span>
                  </Button>
                  <QuestionMediaView media={o.media} label={`Media pilihan ${String.fromCharCode(65 + k)}`} exam />
                </div>
              );
            })}
            {q.type === "bs" && (
              <div className="grid grid-cols-2 gap-3">
                {[true, false].map((v) => (
                  <Button key={String(v)} size="lg" variant={answers[q.id]?.value === v ? "default" : "outline"} onClick={() => set(v)}>{v ? "Benar" : "Salah"}</Button>
                ))}
              </div>
            )}
            {q.type === "isian" && <Input placeholder="Ketik jawaban…" maxLength={500} value={(answers[q.id]?.value as string) ?? ""} onChange={(e) => set(e.target.value)} />}
            {q.type === "uraian" && <Textarea rows={8} placeholder="Tulis jawaban uraian…" maxLength={5000} value={(answers[q.id]?.value as string) ?? ""} onChange={(e) => set(e.target.value)} />}
          </div>
          <div className="mt-8 flex justify-between gap-2">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft className="h-4 w-4" /> Sebelumnya</Button>
            {idx < exam.questions.length - 1
              ? <Button onClick={() => setIdx(idx + 1)}>Berikutnya <ChevronRight className="h-4 w-4" /></Button>
              : <Button onClick={() => setConfirmOpen(true)}><Send className="h-4 w-4" /> Kirim</Button>}
          </div>
        </section>
        <aside className="h-fit rounded-2xl border bg-card p-4 lg:sticky lg:top-24">
          <p className="mb-3 text-sm font-semibold">Navigasi soal</p>
          <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
            {exam.questions.map((x, i) => {
              const fl = answers[x.id]?.flagged, an = isAnswered(x.id);
              return (
                <button key={x.id} onClick={() => setIdx(i)} className={`aspect-square rounded-lg text-sm font-bold ${i === idx ? "ring-2 ring-ring ring-offset-2" : ""} ${fl ? "bg-warning text-warning-foreground" : an ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p><span className="mr-1 inline-block h-3 w-3 rounded bg-primary align-middle" />Dijawab</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded bg-warning align-middle" />Ragu-ragu</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded bg-muted align-middle" />Belum dijawab</p>
          </div>
          <Button className="mt-4 w-full" onClick={() => setConfirmOpen(true)} disabled={submitting}><Send className="h-4 w-4" /> {waitingSubmit ? "Menunggu koneksi…" : "Kirim Jawaban"}</Button>
        </aside>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kirim jawaban sekarang?</AlertDialogTitle>
            <AlertDialogDescription>
              {unanswered > 0 ? `Masih ada ${unanswered} soal belum dijawab. ` : "Semua soal sudah dijawab. "}
              Setelah dikirim, jawaban tidak dapat diubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Periksa lagi</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit} disabled={submitting}>{submitting ? "Mengirim…" : "Ya, kirim"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4">{children}</div>;
}
function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-bold">{v}</p></div>;
}
