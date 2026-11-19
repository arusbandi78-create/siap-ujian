create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('teacher');
create type public.question_type as enum ('pg','isian','bs','uraian');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  school text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'teacher');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  subject text not null default '',
  topic text not null default '',
  type public.question_type not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer jsonb,
  points int not null default 1 check (points between 1 and 100),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "teacher own questions" on public.questions for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and public.has_role(auth.uid(),'teacher'));

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  title text not null,
  subject text not null default '',
  code text not null unique,
  instructions text not null default '',
  duration_minutes int not null default 60 check (duration_minutes between 1 and 600),
  start_at timestamptz not null default now(),
  end_at timestamptz not null default (now() + interval '7 days'),
  question_count int,
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  kkm int not null default 75 check (kkm between 0 and 100),
  show_results boolean not null default false,
  is_active boolean not null default true,
  require_fullscreen boolean not null default true,
  max_violations int not null default 3 check (max_violations between 1 and 50),
  violation_action text not null default 'suspend' check (violation_action in ('warn','suspend','submit')),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.exams to authenticated;
grant all on public.exams to service_role;
alter table public.exams enable row level security;
create policy "teacher own exams" on public.exams for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and public.has_role(auth.uid(),'teacher'));

create table public.exam_questions (
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  position int not null default 0,
  primary key (exam_id, question_id)
);
grant select, insert, update, delete on public.exam_questions to authenticated;
grant all on public.exam_questions to service_role;
alter table public.exam_questions enable row level security;
create policy "teacher own exam questions" on public.exam_questions for all to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = auth.uid()))
  with check (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = auth.uid())
    and exists (select 1 from public.questions q where q.id = question_id and q.teacher_id = auth.uid()));

create table public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  username text not null,
  full_name text not null,
  class_name text not null default '',
  pin_hash text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, username)
);
grant select, update, delete on public.students to authenticated;
grant all on public.students to service_role;
alter table public.students enable row level security;
create policy "teacher own students read" on public.students for select to authenticated using (teacher_id = auth.uid());
create policy "teacher own students update" on public.students for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teacher own students delete" on public.students for delete to authenticated using (teacher_id = auth.uid());
revoke select (pin_hash) on public.students from authenticated;

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  token_hash text,
  status text not null default 'ready' check (status in ('ready','in_progress','suspended','submitted')),
  question_order jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  deadline_at timestamptz,
  submitted_at timestamptz,
  last_seen_at timestamptz,
  score numeric(6,2),
  violation_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (exam_id, student_id)
);
grant select, update, delete on public.attempts to authenticated;
grant all on public.attempts to service_role;
alter table public.attempts enable row level security;
create policy "teacher attempts" on public.attempts for all to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = auth.uid()))
  with check (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = auth.uid()));
revoke select (token_hash) on public.attempts from authenticated;

create table public.answers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  value jsonb,
  flagged boolean not null default false,
  is_correct boolean,
  points_awarded numeric(6,2),
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
grant select, update on public.answers to authenticated;
grant all on public.answers to service_role;
alter table public.answers enable row level security;
create policy "teacher answers" on public.answers for all to authenticated
  using (exists (select 1 from public.attempts a join public.exams e on e.id = a.exam_id where a.id = attempt_id and e.teacher_id = auth.uid()))
  with check (exists (select 1 from public.attempts a join public.exams e on e.id = a.exam_id where a.id = attempt_id and e.teacher_id = auth.uid()));

create table public.violations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  type text not null,
  occurred_at timestamptz not null default now(),
  note text not null default ''
);
grant select on public.violations to authenticated;
grant all on public.violations to service_role;
alter table public.violations enable row level security;
create policy "teacher violations" on public.violations for select to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = auth.uid()));

-- Students: created via function so PIN is hashed in DB
create or replace function public.create_student(_username text, _full_name text, _class text, _pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(), 'teacher') then raise exception 'forbidden'; end if;
  if _username !~ '^[a-z0-9._-]{3,40}$' then raise exception 'Username tidak valid'; end if;
  if _pin !~ '^[0-9]{4,8}$' then raise exception 'PIN harus 4-8 digit angka'; end if;
  if length(trim(_full_name)) = 0 or length(_full_name) > 120 then raise exception 'Nama tidak valid'; end if;
  insert into public.students (teacher_id, username, full_name, class_name, pin_hash)
  values (auth.uid(), _username, trim(_full_name), left(trim(coalesce(_class,'')), 40), extensions.crypt(_pin, extensions.gen_salt('bf')))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.create_student(text,text,text,text) from public, anon;
grant execute on function public.create_student(text,text,text,text) to authenticated;

create or replace function public.reset_student_pin(_id uuid, _pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if _pin !~ '^[0-9]{4,8}$' then raise exception 'PIN harus 4-8 digit angka'; end if;
  update public.students set pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf'))
  where id = _id and teacher_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
end $$;
revoke execute on function public.reset_student_pin(uuid,text) from public, anon;
grant execute on function public.reset_student_pin(uuid,text) to authenticated;

create or replace function public.verify_student_login(_code text, _username text, _pin text)
returns table (student_id uuid, exam_id uuid) language sql stable security definer set search_path = public, extensions as $$
  select s.id, e.id from public.exams e
  join public.students s on s.teacher_id = e.teacher_id
  where upper(e.code) = upper(_code) and e.is_active
    and s.username = lower(_username)
    and s.pin_hash = extensions.crypt(_pin, s.pin_hash)
  limit 1
$$;
revoke execute on function public.verify_student_login(text,text,text) from public, anon, authenticated;
grant execute on function public.verify_student_login(text,text,text) to service_role;

create or replace function public.grade_attempt(_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_teacher uuid; v_max numeric; v_got numeric;
begin
  select e.teacher_id into v_teacher from public.attempts a join public.exams e on e.id = a.exam_id where a.id = _attempt;
  if v_teacher is null then raise exception 'not found'; end if;
  if auth.uid() is not null and auth.uid() <> v_teacher then raise exception 'forbidden'; end if;

  update public.answers an set is_correct = case
      when q.type in ('pg','bs') then an.value is not null and an.value = q.answer
      when q.type = 'isian' then exists (select 1 from jsonb_array_elements_text(coalesce(q.answer,'[]'::jsonb)) x
                                         where lower(trim(x)) = lower(trim(coalesce(an.value #>> '{}',''))))
    end
  from public.questions q where q.id = an.question_id and an.attempt_id = _attempt and q.type <> 'uraian';
  update public.answers an set points_awarded = case when an.is_correct then q.points else 0 end
  from public.questions q where q.id = an.question_id and an.attempt_id = _attempt and q.type <> 'uraian';

  select coalesce(sum(q.points),0) into v_max from public.attempts a
    cross join lateral jsonb_array_elements_text(a.question_order) qid
    join public.questions q on q.id = qid::uuid where a.id = _attempt;
  select coalesce(sum(points_awarded),0) into v_got from public.answers where attempt_id = _attempt;
  update public.attempts set score = case when v_max > 0 then round(least(v_got, v_max) / v_max * 100, 2) else 0 end where id = _attempt;
end $$;
revoke execute on function public.grade_attempt(uuid) from public, anon;
grant execute on function public.grade_attempt(uuid) to authenticated, service_role;

create index on public.violations (exam_id, occurred_at desc);
create index on public.attempts (exam_id);