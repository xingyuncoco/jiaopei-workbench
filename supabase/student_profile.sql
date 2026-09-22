-- 阶段 1：学生学情档案（入学基线 + 历次评估）
-- 设计要点：
--   1. 评估记录只新增、不覆盖，保证「入学 vs 现在」永远可比
--   2. assess_type 区分评估性质，enroll 即入学基线
--   3. 「哪科薄弱」不落库，由最新评估的 level 排序算出（派生数据不存储）
-- 用法：在 Supabase 后台 SQL Editor 整段执行（可重复执行）

-- 1. 学生表补充学信息
alter table students add column if not exists enrolled_at date;
comment on column students.enrolled_at is '入学日期，用于计算就读时长与对比周期';

-- 2. 各科历次学情评估
create table if not exists subject_assessments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  assess_date date not null default current_date,
  -- enroll=入学基线, daily=日常, midterm=期中, final=期末
  assess_type text   not null default 'daily'
              check (assess_type in ('enroll', 'daily', 'midterm', 'final')),
  level       int    not null check (level between 1 and 5),
  weak_points text,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 同一学生同一科目同一天同一类型只留一条，避免重复录入
create unique index if not exists uniq_assessment
  on subject_assessments (student_id, subject_id, assess_date, assess_type);

-- 查询「某生某科历次评估」走索引
create index if not exists idx_assessment_lookup
  on subject_assessments (student_id, subject_id, assess_date desc);

-- 3. 行级安全：与既有表一致，登录老师可共享读写
alter table subject_assessments enable row level security;

drop policy if exists teachers_read_all  on subject_assessments;
drop policy if exists teachers_write_all on subject_assessments;

create policy teachers_read_all on subject_assessments
  for select to authenticated using (true);
create policy teachers_write_all on subject_assessments
  for all to authenticated using (true) with check (true);
