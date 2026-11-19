-- Migration: remove PIN from student login
-- Make pin_hash nullable
ALTER TABLE public.students ALTER COLUMN pin_hash DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN pin_hash SET DEFAULT NULL;

-- Modify verify_student_login to not check PIN
DROP FUNCTION IF EXISTS public.verify_student_login(text,text,text);
CREATE OR REPLACE FUNCTION public.verify_student_login(_code text, _full_name text)
returns table (student_id uuid, exam_id uuid) language sql stable security definer set search_path = public as $$
  select s.id, e.id from public.exams e
  join public.students s on s.teacher_id = e.teacher_id
  where upper(e.code) = upper(_code) and e.is_active
    and lower(s.full_name) = lower(trim(_full_name))
  limit 1
$$;
revoke execute on function public.verify_student_login(text,text) from public, anon, authenticated;
grant execute on function public.verify_student_login(text,text) to service_role;

-- Modify create_student to not require PIN
DROP FUNCTION IF EXISTS public.create_student(text,text,text,text);
CREATE OR REPLACE FUNCTION public.create_student(_username text, _full_name text, _class text, _pin text DEFAULT NULL)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_username text;
begin
  if not public.has_role(auth.uid(), 'teacher') then raise exception 'forbidden'; end if;
  if length(trim(_full_name)) = 0 or length(_full_name) > 120 then raise exception 'Nama tidak valid'; end if;
  -- Auto-generate username from full_name
  v_username := lower(regexp_replace(trim(_full_name), '[^a-zA-Z0-9]', '.', 'g'));
  v_username := regexp_replace(v_username, '\.+', '.', 'g');
  v_username := trim(both '.' from v_username);
  if length(v_username) < 3 then v_username := v_username || '.siswa'; end if;
  v_username := left(v_username, 40);
  -- Ensure uniqueness
  while exists (select 1 from public.students where teacher_id = auth.uid() and username = v_username) loop
    v_username := left(v_username, 37) || '.' || floor(random() * 999)::text;
  end loop;
  insert into public.students (teacher_id, username, full_name, class_name, pin_hash)
  values (auth.uid(), v_username, trim(_full_name), left(trim(coalesce(_class,'')), 40), null)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.create_student(text,text,text,text) from public, anon;
grant execute on function public.create_student(text,text,text,text) to authenticated;
grant execute on function public.create_student(text,text,text) to authenticated;
