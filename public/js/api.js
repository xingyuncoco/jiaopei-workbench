/**
 * 直接使用 Supabase JavaScript SDK
 * 浏览器端直接连接数据库
 */

// Supabase 配置
const SUPABASE_URL = 'https://itcrmmkpblayymqvyzaf.supabase.co'
const supabaseAnonKey = localStorage.getItem('supabase_anon_key') || ''

// 通过全局变量 supabase 访问 CDN 加载的 SDK
const supabaseClient = supabase.createClient(SUPABASE_URL, supabaseAnonKey)

// 获取 token
function getToken() {
  return localStorage.getItem('auth_token') || '';
}

// 设置认证 token
window.setAuthToken = function (token) {
  localStorage.setItem('auth_token', token)
  supabaseClient.auth.setSession({
    access_token: token,
    refresh_token: ''
  })
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
