import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { batches, readAllRows, seededShuffle, selectExamQuestions } from "./exam-rules";
import { MEDIA_BUCKET, parseMedia, type PlayableMedia } from "./question-media";

/* eslint-disable @typescript-eslint/no-explicit-any */

const tokenSchema = z.object({ token: z.string().min(20).max(200) });

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadAttempt(token: string) {
  const db = await getAdmin();
  const { data, error } = await db
    .from("attempts")
    .select("*, exams(*), students(full_name, username, class_name)")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (error) throw new Error("Gagal memuat sesi ujian.");
  if (!data) throw new Error("Sesi tidak valid. Silakan masuk kembali.");
  return { db, a: data as any };
}

async function submitAttempt(db: any, attemptId: string, at?: string) {
  await db.rpc("grade_attempt", { _attempt: attemptId });
  await db
    .from("attempts")
    .update({ status: "submitted", submitted_at: at ?? new Date().toISOString() })
    .eq("id", attemptId)
    .neq("status", "submitted");
}

/** Auto-submit when the server deadline has passed. Returns current status. */
async function finalizeIfExpired(db: any, a: any): Promise<string> {
  if ((a.status === "in_progress" || a.status === "suspended") && a.deadline_at) {
    if (Date.now() >= new Date(a.deadline_at).getTime()) {
      await submitAttempt(db, a.id, a.deadline_at);
      a.status = "submitted";
    }
  }
  return a.status;
}

function examPublic(e: any) {
  return {
    title: e.title,
    subject: e.subject,
    instructions: e.instructions,
    duration_minutes: e.duration_minutes,
    start_at: e.start_at,
    end_at: e.end_at,
    kkm: e.kkm,
    require_fullscreen: e.require_fullscreen,
    max_violations: e.max_violations,
    violation_action: e.violation_action as "warn" | "suspend" | "submit",
    show_results: e.show_results,
  };
}

export const studentLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(4).max(12),
        username: z.string().trim().min(3).max(40),
        pin: z.string().regex(/^[0-9]{4,8}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await getAdmin();
    const { data: rows, error } = await db.rpc("verify_student_login", {
      _code: data.code,
      _username: data.username.toLowerCase(),
      _pin: data.pin,
    });
    if (error) throw new Error("Gagal memverifikasi. Coba lagi.");
    const row = (rows as any[])?.[0];
    if (!row) return { ok: false as const, message: "Kode ujian, username, atau PIN salah." };

    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const token_hash = await sha256(token);
    const { data: existing } = await db
      .from("attempts")
      .select("id")
      .eq("exam_id", row.exam_id)
      .eq("student_id", row.student_id)
      .maybeSingle();
    if (existing) {
      await db.from("attempts").update({ token_hash }).eq("id", existing.id);
    } else {
      const { error: insErr } = await db
        .from("attempts")
        .insert({ exam_id: row.exam_id, student_id: row.student_id, token_hash });
      if (insErr) throw new Error("Gagal membuat sesi ujian.");
    }
    return { ok: true as const, token };
  });

export const getExamInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { db, a } = await loadAttempt(data.token);
    const status = await finalizeIfExpired(db, a);
    const { count } = await db
      .from("exam_questions")
      .select("question_id", { count: "exact", head: true })
      .eq("exam_id", a.exam_id);
    const total = a.exams.question_count ? Math.min(a.exams.question_count, count ?? 0) : (count ?? 0);
    return {
      status: status as "ready" | "in_progress" | "suspended" | "submitted",
      serverNow: new Date().toISOString(),
      deadline_at: a.deadline_at as string | null,
      violation_count: a.violation_count as number,
      resume_version: a.resume_version as number,
      student: a.students as { full_name: string; username: string; class_name: string },
      exam: examPublic(a.exams),
      total_questions: total,
    };
  });

export const startExam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { db, a } = await loadAttempt(data.token);
    const e = a.exams;
    if (a.status === "in_progress" && !a.resume_allowed) {
      const { lockExamExit } = await import("./exam-exit.server");
      await lockExamExit(data.token, "page_exit", a.resume_version);
      a.status = "suspended";
    }
    let status = await finalizeIfExpired(db, a);
    if (status === "submitted") return { status: "submitted" as const };
    if (status === "suspended") return { status: "suspended" as const, violation_count: a.violation_count };

    const now = Date.now();
    if (status === "ready") {
      if (!e.is_active) throw new Error("Ujian tidak aktif.");
      if (now < new Date(e.start_at).getTime()) throw new Error("Ujian belum dimulai. Tunggu sesuai jadwal.");
      if (now >= new Date(e.end_at).getTime()) throw new Error("Jadwal ujian sudah berakhir.");
      const eq = await readAllRows((from, to) => db.from("exam_questions").select("question_id, position").eq("exam_id", e.id).order("position").order("question_id").range(from, to));
      const ids = selectExamQuestions(eq.map((r: any) => r.question_id), e.question_count, e.shuffle_questions, a.id);
      const deadline = Math.min(now + e.duration_minutes * 60000, new Date(e.end_at).getTime());
      const { data: upd } = await db
        .from("attempts")
        .update({
          status: "in_progress",
          question_order: ids,
          started_at: new Date(now).toISOString(),
          deadline_at: new Date(deadline).toISOString(),
        })
        .eq("id", a.id)
        .eq("status", "ready")
        .select("*")
        .maybeSingle();
      if (upd) Object.assign(a, upd);
      else Object.assign(a, (await db.from("attempts").select("*").eq("id", a.id).single()).data);
      status = a.status;
    }

    await db.from("attempts").update({ resume_allowed: false }).eq("id", a.id).eq("status", "in_progress");
    const ids: string[] = a.question_order ?? [];
    const qs: any[] = [];
    for (const group of batches(ids)) {
      const { data: rows, error } = await db.from("questions").select("id, teacher_id, type, prompt, options, media, option_media, points").in("id", group).eq("teacher_id", e.teacher_id);
      if (error) throw new Error("Gagal memuat soal.");
      qs.push(...(rows ?? []));
    }
    const byId = new Map((qs ?? []).map((q: any) => [q.id, q]));
    const paths = [...new Set<string>(qs.flatMap((q) => [q.media, ...(Array.isArray(q.option_media) ? q.option_media : [])].map(parseMedia).filter((m) => m && m.kind !== "youtube" && m.path.startsWith(`${e.teacher_id}/`)).map((m) => m && m.kind !== "youtube" ? m.path : "")))];
    const urls = new Map<string, string>();
    const ttl = Math.max(3600, Math.min(86400 * 7, Math.ceil((new Date(a.deadline_at).getTime() - Date.now()) / 1000) + 3600));
    for (const group of batches(paths)) {
      const { data: signed, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(group, ttl);
      if (error) throw new Error("Gagal memuat media soal.");
      for (const item of signed ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
    const playable = (value: unknown): PlayableMedia | null => {
      const media = parseMedia(value);
      if (!media || media.kind === "youtube") return media;
      const raw = urls.get(media.path);
      if (!raw) return null;
      const browserUrl = import.meta.env['VITE_SUPABASE_URL'];
      const url = new URL(raw);
      return { ...media, src: `${browserUrl}${url.pathname}${url.search}` };
    };
    const questions = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((q: any) => {
        let opts = (q.options as string[]).map((text, i) => ({ i, text, media: playable(q.option_media?.[i]) }));
        if (q.type === "pg" && e.shuffle_options) opts = seededShuffle(opts, a.id + q.id);
        return { id: q.id as string, type: q.type as "pg" | "isian" | "bs" | "uraian", prompt: q.prompt as string, media: playable(q.media), options: opts, points: q.points as number };
      });
    const ans = await readAllRows((from, to) => db.from("answers").select("question_id, value, flagged").eq("attempt_id", a.id).order("question_id").range(from, to));
    return {
      status: status as "in_progress",
      serverNow: new Date().toISOString(),
      deadline_at: a.deadline_at as string,
      violation_count: a.violation_count as number,
      resume_version: a.resume_version as number,
      exam: examPublic(e),
      questions,
      answers: (ans ?? []) as { question_id: string; value: string | number | boolean | null; flagged: boolean }[],
    };
  });

const answerValue = z.union([z.number().int().min(0).max(20), z.boolean(), z.string().max(5000), z.null()]);

export const saveAnswers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    tokenSchema
      .extend({
        answers: z
          .array(z.object({ question_id: z.string().uuid(), value: answerValue, flagged: z.boolean() }))
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { db, a } = await loadAttempt(data.token);
    const status = await finalizeIfExpired(db, a);
    if (status !== "in_progress") return { status, saved: 0 };
    const allowed = new Set<string>(a.question_order ?? []);
    const rows = data.answers
      .filter((x) => allowed.has(x.question_id))
      .map((x) => ({
        attempt_id: a.id,
        question_id: x.question_id,
        value: x.value as any,
        flagged: x.flagged,
        updated_at: new Date().toISOString(),
      }));
    if (rows.length) {
      const { error } = await db.from("answers").upsert(rows, { onConflict: "attempt_id,question_id" });
      if (error) throw new Error("Gagal menyimpan jawaban.");
    }
    await db.from("attempts").update({ last_seen_at: new Date().toISOString() }).eq("id", a.id);
    return { status, saved: rows.length };
  });

export const logViolation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.extend({ type: z.enum(["tab_hidden", "window_blur", "exit_fullscreen", "navigation", "page_exit"]), version: z.number().int().min(0) }).parse(d))
  .handler(async ({ data }) => {
    const { lockExamExit } = await import("./exam-exit.server");
    await lockExamExit(data.token, data.type, data.version);
    const { db, a } = await loadAttempt(data.token);
    const status = await finalizeIfExpired(db, a);
    return { status, count: a.violation_count as number, max: a.exams.max_violations as number };
  });

export const submitExam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { db, a } = await loadAttempt(data.token);
    const status = await finalizeIfExpired(db, a);
    if (status === "in_progress") await submitAttempt(db, a.id);
    else if (status !== "submitted") throw new Error("Ujian tidak dapat dikirim saat ini.");
    return { status: "submitted" as const };
  });

export const getResult = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { db, a } = await loadAttempt(data.token);
    await finalizeIfExpired(db, a);
    const base = { status: a.status as string, title: a.exams.title as string, student: a.students.full_name as string, submitted_at: a.submitted_at as string | null };
    if (a.status !== "submitted" || !a.exams.show_results) return { ...base, visible: false as const };
    const { data: fresh } = await db.from("attempts").select("score").eq("id", a.id).single();
    const score = Number(fresh?.score ?? 0);
    return { ...base, visible: true as const, score, kkm: a.exams.kkm as number, passed: score >= a.exams.kkm };
  });
