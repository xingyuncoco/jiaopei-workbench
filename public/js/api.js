/**
 * 直接使用 Supabase JavaScript SDK
 * 浏览器端直接连接数据库
 */

// Supabase 配置
// publishable key 设计为可公开，安全性依赖数据库的 RLS 行级策略
const SUPABASE_URL = 'https://itcrmmkpblayymqvyzaf.supabase.co'
const supabaseAnonKey = 'sb_publishable_ZXRrPVhLS6CvOQV5JYnBmA_0PiaL0xT'

// 通过全局变量 supabase 访问 CDN 加载的 SDK
const supabaseClient = supabase.createClient(SUPABASE_URL, supabaseAnonKey)

/**
 * 认证相关 API
 * 说明：Supabase SDK 会自动把会话持久化到 localStorage，
 * 刷新页面后无需手动恢复，直接 getSession 即可拿到登录用户。
 */
window.authAPI = {
  // 邮箱 + 密码登录（账号由管理员在 Supabase 后台创建）
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
    if (error) throw error
    return { user: data.user }
  },

  async signOut() {
    const { error } = await supabaseClient.auth.signOut()
    if (error) throw error
  },

  // 取当前会话 access_token，供调用自有后端接口时携带
  async getAccessToken() {
    const { data } = await supabaseClient.auth.getSession()
    return data?.session?.access_token || null
  },

  async getCurrentUser() {
    const { data, error } = await supabaseClient.auth.getSession()
    if (error) throw error
    return data.session?.user || null
  },

  // 会话变化（含被服务端判定失效）时回调，用于自动回到登录页
  onAuthChange(callback) {
    return supabaseClient.auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null)
    })
  }
}

// 学生相关 API
window.studentsAPI = {
  async list() {
    const result = await supabaseClient
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    if (result.error) throw result.error
    return { students: result.data }
  },

  async create(studentData) {
    const userResult = await supabaseClient.auth.getUser()
    const userId = userResult.data?.user?.id

    const result = await supabaseClient
      .from('students')
      .insert({ ...studentData, user_id: userId })
      .select()
      .single()

    if (result.error) throw result.error
    return { student: result.data }
  },

  async update(id, studentData) {
    const result = await supabaseClient
      .from('students')
      .update(studentData)
      .eq('id', id)
      .select()
      .single()

    if (result.error) throw result.error
    return { student: result.data }
  },

  async delete(id) {
    const result = await supabaseClient
      .from('students')
      .delete()
      .eq('id', id)

    if (result.error) throw result.error
    return { success: true }
  }
}

// 学情评估相关 API
window.assessmentsAPI = {
  // 拉取某学生的全部历次评估（含科目信息）
  async listByStudent(studentId) {
    const result = await supabaseClient
      .from('subject_assessments')
      .select(`
        *,
        subject:subjects(id, name, icon)
      `)
      .eq('student_id', studentId)
      .order('assess_date', { ascending: true })

    if (result.error) throw result.error
    return { assessments: result.data }
  },

  async create(data) {
    const userResult = await supabaseClient.auth.getUser()
    const result = await supabaseClient
      .from('subject_assessments')
      .insert({ ...data, created_by: userResult.data?.user?.id })
      .select()
      .single()

    if (result.error) throw result.error
    return { assessment: result.data }
  },

  async delete(id) {
    const result = await supabaseClient
      .from('subject_assessments')
      .delete()
      .eq('id', id)

    if (result.error) throw result.error
    return { success: true }
  }
}

// 某学生某周期的作业统计，供 AI 周总结使用
window.weekStatsAPI = {
  async fetch(studentId, weekStart, weekEnd) {
    const [plansRes, reportsRes] = await Promise.all([
      supabaseClient
        .from('homework_plans')
        .select('id, is_completed, subject:subjects(id, name)')
        .eq('student_id', studentId)
        .gte('plan_date', weekStart)
        .lte('plan_date', weekEnd),
      supabaseClient
        .from('homework_reports')
        .select('plan_id, accuracy, subject:subjects(id, name)')
        .eq('student_id', studentId)
        .gte('plan_date', weekStart)
        .lte('plan_date', weekEnd)
    ])

    if (plansRes.error) throw plansRes.error
    if (reportsRes.error) throw reportsRes.error

    // 按科目聚合：布置/完成次数 + 平均正确率
    const stats = {}
    ;(plansRes.data || []).forEach(p => {
      const name = p.subject?.name || '未知'
      if (!stats[name]) stats[name] = { subject: name, total: 0, completed: 0, accuracies: [] }
      stats[name].total++
      if (p.is_completed) stats[name].completed++
    })
    ;(reportsRes.data || []).forEach(r => {
      const name = r.subject?.name || '未知'
      if (!stats[name]) stats[name] = { subject: name, total: 0, completed: 0, accuracies: [] }
      if (typeof r.accuracy === 'number') stats[name].accuracies.push(r.accuracy)
    })

    return Object.values(stats).map(s => ({
      subject: s.subject,
      total: s.total,
      completed: s.completed,
      avg_accuracy: s.accuracies.length
        ? Math.round(s.accuracies.reduce((a, b) => a + b, 0) / s.accuracies.length)
        : null
    }))
  }
}

// 科目相关 API
window.subjectsAPI = {
  async list() {
    const result = await supabaseClient
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: true })

    if (result.error) throw result.error
    return { subjects: result.data }
  },

  async create(subjectData) {
    const userResult = await supabaseClient.auth.getUser()
    const userId = userResult.data?.user?.id

    const result = await supabaseClient
      .from('subjects')
      .insert({ ...subjectData, user_id: userId })
      .select()
      .single()

    if (result.error) throw result.error
    return { subject: result.data }
  },

  async update(id, subjectData) {
    const result = await supabaseClient
      .from('subjects')
      .update(subjectData)
      .eq('id', id)
      .select()
      .single()

    if (result.error) throw result.error
    return { subject: result.data }
  },

  async delete(id) {
    const result = await supabaseClient
      .from('subjects')
      .delete()
      .eq('id', id)

    if (result.error) throw result.error
    return { success: true }
  }
}

// 规划相关 API
window.plansAPI = {
  async list(params = {}) {
    let query = supabaseClient
      .from('homework_plans')
      .select(`
        *,
        student:students(id, name, grade),
        subject:subjects(id, name, icon)
      `)

    if (params.date) {
      query = query.eq('plan_date', params.date)
    }
    if (params.student_id) {
      query = query.eq('student_id', params.student_id)
    }

    const result = await query.order('created_at', { ascending: true })

    if (result.error) throw result.error
    return { plans: result.data }
  },

  async create(planData) {
    const userResult = await supabaseClient.auth.getUser()
    const userId = userResult.data?.user?.id

    const result = await supabaseClient
      .from('homework_plans')
      .insert({ ...planData, user_id: userId })
      .select(`
        *,
        student:students(id, name, grade),
        subject:subjects(id, name, icon)
      `)
      .single()

    if (result.error) throw result.error
    return { plan: result.data }
  },

  async update(id, planData) {
    const result = await supabaseClient
      .from('homework_plans')
      .update(planData)
      .eq('id', id)
      .select(`
        *,
        student:students(id, name, grade),
        subject:subjects(id, name, icon)
      `)
      .single()

    if (result.error) throw result.error
    return { plan: result.data }
  },

  async toggleComplete(id, isCompleted) {
    return this.update(id, { is_completed: isCompleted })
  },

  async delete(id) {
    const result = await supabaseClient
      .from('homework_plans')
      .delete()
      .eq('id', id)

    if (result.error) throw result.error
    return { success: true }
  }
}

// 批改相关 API
window.reportsAPI = {
  async list(params = {}) {
    let query = supabaseClient
      .from('homework_reports')
      .select(`
        *,
        student:students(id, name, grade),
        subject:subjects(id, name, icon)
      `)

    if (params.date) {
      query = query.eq('plan_date', params.date)
    }
    if (params.student_id) {
      query = query.eq('student_id', params.student_id)
    }

    const result = await query.order('created_at', { ascending: false })

    if (result.error) throw result.error
    return { reports: result.data }
  },

  async get(id) {
    const result = await supabaseClient
      .from('homework_reports')
      .select(`
        *,
        student:students(id, name, grade),
        subject:subjects(id, name, icon)
      `)
      .eq('id', id)
      .single()

    if (result.error) throw result.error
    return { report: result.data }
  },

  async delete(id) {
    const result = await supabaseClient
      .from('homework_reports')
      .delete()
      .eq('id', id)

    if (result.error) throw result.error
    return { success: true }
  }
}

// 总结相关 API
window.summariesAPI = {
  async get(date) {
    const result = await supabaseClient
      .from('daily_summaries')
      .select('*')
      .eq('summary_date', date)
      .single()

    if (result.error && result.error.code !== 'PGRST116') throw result.error
    return { summary: result.data || null }
  },

  async generate(date) {
    const countResult = await supabaseClient
      .from('students')
      .select('*', { count: 'exact', head: true })

    const totalStudents = countResult.count || 0

    const plansResult = await supabaseClient
      .from('homework_plans')
      .select(`*, subject:subjects(id, name)`)
      .eq('plan_date', date)

    const reportsResult = await supabaseClient
      .from('homework_reports')
      .select(`*, subject:subjects(id, name)`)
      .eq('plan_date', date)

    const plans = plansResult.data || []
    const reports = reportsResult.data || []

    const subjectStats = {}
    plans.forEach(p => {
      const name = p.subject?.name || '未知'
      if (!subjectStats[name]) {
        subjectStats[name] = { name, total: 0, completed: 0, accuracies: [] }
      }
      subjectStats[name].total++
      if (p.is_completed) subjectStats[name].completed++
    })

    const completedStudents = new Set(
      plans.filter(p => p.is_completed).map(p => p.student_id)
    ).size

    const userResult = await supabaseClient.auth.getUser()
    const userId = userResult.data?.user?.id

    const avgAccuracy = reports.length > 0
      ? Math.round(reports.reduce((a, r) => a + (r.accuracy || 0), 0) / reports.length)
      : 0

    const detailText = `今日共${totalStudents}名学生，${completedStudents}人完成作业。`

    return {
      summary: {
        summary_date: date,
        user_id: userId,
        total_students: totalStudents,
        completed_count: completedStudents,
        avg_accuracy: avgAccuracy,
        subject_summary: Object.values(subjectStats),
        detail_text: detailText,
        copy_text: detailText
      }
    }
  }
}
