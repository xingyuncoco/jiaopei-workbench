-- =============================================
-- 迁移脚本：为已存在的表添加新字段
-- 在 Supabase SQL Editor 中执行
-- =============================================

-- students 表添加家长绑定字段
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_ids TEXT[];
ALTER TABLE students ADD COLUMN IF NOT EXISTS bind_code VARCHAR(10) UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS latest_scores JSONB DEFAULT '{}';

-- homework_reports 表添加新字段
ALTER TABLE homework_reports ADD COLUMN IF NOT EXISTS wrong_count INTEGER DEFAULT 0;
ALTER TABLE homework_reports ADD COLUMN IF NOT EXISTS empty_count INTEGER DEFAULT 0;
ALTER TABLE homework_reports ADD COLUMN IF NOT EXISTS weak_points TEXT[];
ALTER TABLE homework_reports ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
ALTER TABLE homework_reports ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 如果 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS，用下面的方式：

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'parent_ids') THEN
        ALTER TABLE students ADD COLUMN parent_ids TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'bind_code') THEN
        ALTER TABLE students ADD COLUMN bind_code VARCHAR(10) UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'latest_scores') THEN
        ALTER TABLE students ADD COLUMN latest_scores JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homework_reports' AND column_name = 'wrong_count') THEN
        ALTER TABLE homework_reports ADD COLUMN wrong_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homework_reports' AND column_name = 'empty_count') THEN
        ALTER TABLE homework_reports ADD COLUMN empty_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homework_reports' AND column_name = 'weak_points') THEN
        ALTER TABLE homework_reports ADD COLUMN weak_points TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homework_reports' AND column_name = 'is_published') THEN
        ALTER TABLE homework_reports ADD COLUMN is_published BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homework_reports' AND column_name = 'published_at') THEN
        ALTER TABLE homework_reports ADD COLUMN published_at TIMESTAMPTZ;
    END IF;
END $$;

-- 验证字段是否添加成功
SELECT 'students 表字段:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'students' AND column_name IN ('parent_ids', 'bind_code', 'latest_scores');

SELECT 'homework_reports 表字段:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'homework_reports' AND column_name IN ('wrong_count', 'empty_count', 'weak_points', 'is_published', 'published_at');
