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
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

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

-- =============================================
-- 启用 RLS (行级安全策略)
-- =============================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

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
