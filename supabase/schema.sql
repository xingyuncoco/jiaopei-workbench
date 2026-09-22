-- =============================================
-- 教培教师工作台 - 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行
-- =============================================

-- 1. 创建 students 表（学生信息）
CREATE TABLE IF NOT EXISTS students (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    name            VARCHAR(50) NOT NULL,
    grade           VARCHAR(20),
    group_name      VARCHAR(100),
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建 subjects 表（科目模板）
CREATE TABLE IF NOT EXISTS subjects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    name            VARCHAR(50) NOT NULL,
    icon            VARCHAR(10) DEFAULT '📝',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 3. 创建 homework_plans 表（每日作业规划）
CREATE TABLE IF NOT EXISTS homework_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE,
    plan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time      TIME,
    end_time        TIME,
    is_completed    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, plan_date)
);

-- 4. 创建 homework_reports 表（批改报告）
CREATE TABLE IF NOT EXISTS homework_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE,
    plan_id         UUID REFERENCES homework_plans(id) ON DELETE SET NULL,
    plan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    image_url       TEXT,
    correct_count   INTEGER,
    total_count     INTEGER,
    accuracy        DECIMAL(5,2),
    errors_detail   JSONB,
    suggestion      TEXT,
    full_report     TEXT,
    batch_id        UUID,  -- 同一批次多张照片共用一个 batch_id
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 为 batch_id 创建索引（如果表已存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reports_batch') THEN
        CREATE INDEX idx_reports_batch ON homework_reports (batch_id);
    END IF;
END $$;

-- 5. 创建 daily_summaries 表（每日总结）
CREATE TABLE IF NOT EXISTS daily_summaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    summary_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    total_students  INTEGER,
    completed_count INTEGER,
    avg_accuracy    DECIMAL(5,2),
    subject_summary JSONB,
    detail_text     TEXT,
    copy_text       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, summary_date)
);

-- 6. 创建 summary_history 表（总结历史记录）
-- kind: 'homework' 作业情况 / 'daily' 日常总结 / 'weekly' 周总结
-- student_id 按学生存储（homework 也按学生生成一份）
-- teacher_note: 日常总结中老师填写的备注
-- payload: 调用 AI 时使用的完整数据快照，便于复现
CREATE TABLE IF NOT EXISTS summary_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            TEXT NOT NULL CHECK (kind IN ('homework', 'daily', 'weekly')),
    student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
    period_start    DATE,
    period_end      DATE,
    teacher_note    TEXT,
    content         TEXT NOT NULL,
    payload         JSONB,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 启用 RLS (行级安全策略)
-- =============================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_history ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS 策略：每个用户只能访问自己的数据
-- =============================================

-- students 策略
CREATE POLICY "users_can_manage_own_students" ON students
    FOR ALL USING (auth.uid() = user_id);

-- subjects 策略
CREATE POLICY "users_can_manage_own_subjects" ON subjects
    FOR ALL USING (auth.uid() = user_id);

-- homework_plans 策略
CREATE POLICY "users_can_manage_own_plans" ON homework_plans
    FOR ALL USING (auth.uid() = user_id);

-- homework_reports 策略
CREATE POLICY "users_can_manage_own_reports" ON homework_reports
    FOR ALL USING (auth.uid() = user_id);

-- daily_summaries 策略
CREATE POLICY "users_can_manage_own_summaries" ON daily_summaries
    FOR ALL USING (auth.uid() = user_id);

-- summary_history 策略（已登录老师可读、插、删、改）
CREATE POLICY "teachers_read_all" ON summary_history
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "teachers_insert_all" ON summary_history
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "teachers_delete_all" ON summary_history
    FOR DELETE TO authenticated USING (true);
CREATE POLICY "teachers_update_all" ON summary_history
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 创建索引优化查询性能
-- =============================================

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_date ON homework_plans(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_plans_student ON homework_plans(student_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_reports_user_date ON homework_reports(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_reports_student ON homework_reports(student_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_summaries_user_date ON daily_summaries(user_id, summary_date);

-- summary_history 表索引
CREATE INDEX IF NOT EXISTS idx_summary_kind_student_time ON summary_history(kind, student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summary_kind_period ON summary_history(kind, student_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_summary_created_at ON summary_history(created_at);
