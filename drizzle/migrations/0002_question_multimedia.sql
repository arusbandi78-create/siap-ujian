ALTER TABLE public.questions ADD COLUMN media jsonb DEFAULT NULL;
ALTER TABLE public.questions ADD COLUMN option_media jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE POLICY "Teacher read question media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'question-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Teacher upload question media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'question-media' AND (storage.foldername(name))[1] = auth.uid()::text AND public.has_role(auth.uid(), 'teacher') AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp','gif','mp3','wav','ogg','m4a','mp4','webm'));
CREATE OR REPLACE FUNCTION public.valid_question_media(m jsonb, owner_id uuid) RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF m IS NULL OR m = 'null'::jsonb THEN RETURN true; END IF;
 IF jsonb_typeof(m) <> 'object' THEN RETURN false; END IF;
 IF m->>'kind' = 'youtube' THEN RETURN coalesce(m->>'url' ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$',false); END IF;
 IF m->>'kind' NOT IN ('image','audio','video') OR m->>'kind' IS NULL THEN RETURN false; END IF;
 IF NOT coalesce(m->>'path' ~ ('^' || owner_id::text || '/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|gif|mp3|wav|ogg|m4a|mp4|webm)$'),false) THEN RETURN false; END IF;
 IF m->>'kind'='image' AND m->>'path' !~ '\.(png|jpg|jpeg|webp|gif)$' THEN RETURN false; END IF;
 IF m->>'kind'='audio' AND m->>'path' !~ '\.(mp3|wav|ogg|m4a)$' THEN RETURN false; END IF;
 IF m->>'kind'='video' AND m->>'path' !~ '\.(mp4|webm)$' THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='question-media' AND name=m->>'path');
END $$;
CREATE OR REPLACE FUNCTION public.validate_question_multimedia() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m jsonb; n integer; i integer;
BEGIN
 IF NOT public.valid_question_media(NEW.media,NEW.teacher_id) THEN RAISE EXCEPTION 'Media soal tidak valid'; END IF;
 IF jsonb_typeof(NEW.option_media)<>'array' OR jsonb_array_length(NEW.option_media)>6 THEN RAISE EXCEPTION 'Media opsi tidak valid'; END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(NEW.option_media) LOOP
 IF NOT public.valid_question_media(m,NEW.teacher_id) THEN RAISE EXCEPTION 'Media opsi tidak valid'; END IF;
 END LOOP;
 IF length(trim(NEW.prompt))=0 AND (NEW.media IS NULL OR NEW.media='null'::jsonb) THEN RAISE EXCEPTION 'Isi pertanyaan atau media'; END IF;
 IF length(NEW.prompt)>5000 THEN RAISE EXCEPTION 'Pertanyaan terlalu panjang'; END IF;
 IF NEW.type='pg' THEN
 n:=jsonb_array_length(NEW.options);
 IF n<2 OR n>6 OR jsonb_array_length(NEW.option_media)>n THEN RAISE EXCEPTION 'Jumlah opsi tidak valid'; END IF;
 FOR i IN 0..n-1 LOOP
 IF jsonb_typeof(NEW.options->i)<>'string' OR length(NEW.options->>i)>1000 THEN RAISE EXCEPTION 'Teks opsi tidak valid'; END IF;
 IF length(trim(NEW.options->>i))=0 AND (NEW.option_media->i IS NULL OR NEW.option_media->i='null'::jsonb) THEN RAISE EXCEPTION 'Isi teks atau media opsi'; END IF;
 END LOOP;
 IF jsonb_typeof(NEW.answer)<>'number' OR NEW.answer::text !~ '^[0-9]+$' OR (NEW.answer::text)::integer>=n THEN RAISE EXCEPTION 'Kunci jawaban tidak valid'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_question_multimedia BEFORE INSERT OR UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.validate_question_multimedia();