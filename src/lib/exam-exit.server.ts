import { z } from "zod";

export const exitEventSchema = z.object({
  type: z.enum(["tab_hidden", "window_blur", "exit_fullscreen", "navigation", "page_exit"]),
  version: z.number().int().min(0),
});

export async function lockExamExit(token: string, type: string, version: number) {
  if (token.length < 20 || token.length > 200) throw new Error("Sesi tidak valid.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("lock_exam_exit", { _hash: hash, _type: type, _version: version });
  if (error) throw new Error("Gagal mencatat aktivitas keluar.");
}