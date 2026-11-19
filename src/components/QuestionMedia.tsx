import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET, youtubeId, type PlayableMedia } from "@/lib/question-media";

export function QuestionMediaView({ media, label, exam = false }: { media: PlayableMedia | null | undefined; label: string; exam?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false); setSrc(null);
    if (!media || media.kind === "youtube") return;
    if (media.src) { setSrc(media.src); return; }
    void supabase.storage.from(MEDIA_BUCKET).createSignedUrl(media.path, 3600).then(({ data, error }) => {
      if (!live) return;
      if (error) setFailed(true); else setSrc(data?.signedUrl ?? null);
    });
    return () => { live = false; };
  }, [media]);
  if (!media) return null;
  if (media.kind === "youtube") {
    const id = youtubeId(media.url);
    if (!id) return null;
    return <div className="my-3 min-w-0">
      <iframe data-exam-media={exam ? "youtube" : undefined} title={label} className="aspect-video w-full rounded-lg border" src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&fs=0&disablekb=1&playsinline=1`} sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
      <p className="mt-1 text-xs text-muted-foreground">YouTube memerlukan koneksi internet.</p>
    </div>;
  }
  if (failed) return <p role="alert" className="my-2 text-sm text-destructive">Media tidak dapat dimuat. Hubungi guru.</p>;
  if (!src) return <p className="my-2 text-sm text-muted-foreground">Memuat media…</p>;
  const error = () => setFailed(true);
  if (media.kind === "image") return <img src={src} alt={label} onError={error} className="my-3 max-h-80 max-w-full rounded-lg object-contain" />;
  if (media.kind === "audio") return <audio aria-label={label} src={src} controls controlsList="nodownload noplaybackrate" preload="metadata" onError={error} className="my-3 w-full" />;
  return <video aria-label={label} src={src} controls controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture playsInline preload="metadata" onError={error} className="my-3 max-h-80 w-full rounded-lg" />;
}