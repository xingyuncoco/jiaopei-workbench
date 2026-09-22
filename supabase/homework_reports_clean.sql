-- 清理：拍照批改不再存图片，删除 photos 表
-- 同时给 homework_reports 加 batch_id（同一批次多张照片共用）
-- 用法：Supabase 后台 SQL Editor 整段执行，可重复执行

-- 1) 删除照片表（外键 CASCADE 会带走依赖）
drop table if exists homework_report_photos;

-- 2) homework_reports 加 batch_id（多次拍照批改同一作业用同一 batch 关联）
alter table homework_reports add column if not exists batch_id uuid;
create index if not exists idx_reports_batch on homework_reports (batch_id);

-- 3) photo_count 字段不再需要，保留但忽略
