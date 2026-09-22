-- 第二步：建 check 约束（含休息）
do $$
begin
  alter table homework_plans drop constraint if exists homework_plans_lesson_type_check;
exception when others then null;
end $$;

alter table homework_plans add constraint homework_plans_lesson_type_check
  check (lesson_type in ('homework','practice','test','hardpoint','class','oneon_tt1','break'));