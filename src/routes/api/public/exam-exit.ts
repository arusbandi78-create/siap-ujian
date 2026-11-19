import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/exam-exit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
        if (!token || token.length < 20 || token.length > 200) return new Response(null, { status: 401 });
        if (Number(request.headers.get("Content-Length") ?? 0) > 1024) return new Response(null, { status: 413 });
        try {
          const { exitEventSchema, lockExamExit } = await import("@/lib/exam-exit.server");
          const event = exitEventSchema.parse(await request.json());
          await lockExamExit(token, event.type, event.version);
          return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
        } catch { return new Response(null, { status: 400 }); }
      },
    },
  },
});