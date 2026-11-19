<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Teachers authenticate with Lovable Cloud auth and access their own data from the browser client under RLS; why: ownership is enforced by row policies.
- Students never get auth accounts; they log in via `studentLogin` server fn (code+username+PIN verified in SQL with bcrypt) and receive a random token stored hashed on `attempts`; why: keeps answer keys and other students' data unreachable.
- Student RPC actions use `src/lib/exam.functions.ts`; page-exit keepalive uses the token-verified `/api/public/exam-exit` route and shared server-only helper. Answer keys never reach students; why: unload needs a raw HTTP boundary.
- Grading lives in the SQL function `grade_attempt`; why: one source of truth for auto-submit, manual essay grading and teacher regrade.
- Timer deadline is computed and enforced server-side (`deadline_at`); any student call after the deadline auto-submits.
- Offline: `vite-plugin-pwa` (generateSW, NetworkFirst navigations) registered only via `src/lib/pwa.ts` guard; the started exam payload and all answers are cached in localStorage per token so `/ujian` can resume offline and sync on reconnect; why: students must survive connection drops without losing answers.
- An exited or reopened running exam is suspended; database triggers permit resume only for its owning teacher and increment a resume version. Offline exit markers prevent cached reopening; why: offline storage must not bypass teacher approval.
- Read question pools through paginated queries and write uploads/answers in batches; select each student's stable subset on the server; why: request-size limits must not become question-bank limits.
- Generate the violation siren with browser Web Audio, unlocked by the start/resume click and time-limited; why: alarms must work offline without external services and must not interfere with suspension.
- Review incident history from the existing RLS-protected violations records using paginated reads and shared filters; why: completed exams must remain reviewable without duplicating incident data.
- Keep option text and grading indices unchanged; store prompt media and parallel option media separately, validate ownership in a database trigger, and use a private teacher-scoped storage bucket with signed student URLs only for assigned questions; why: multimedia must not expose other teachers' questions or change correct-answer indices.
- Embed only validated YouTube IDs in sandboxed inline players without external navigation or fullscreen; ignore player-focus blur only while visible and retain visibility/page-exit monitoring; why: playing assigned media is not an exam exit.
