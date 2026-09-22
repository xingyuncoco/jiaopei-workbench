/**
 * 直接使用 Supabase JavaScript SDK
 * 浏览器端直接连接数据库
 */

// Supabase 配置 - 从 localStorage 获取
const SUPABASE_URL = 'https://itcrmmkpblayymqvyzaf.supabase.co'
const supabaseAnonKey = localStorage.getItem('supabase_anon_key') || ''

// 通过全局变量 supabase 访问（由 CDN 加载提供）
const supabase = window.supabase.createClient(SUPABASE_URL, supabaseAnonKey)

// 获取 token（从 localStorage）
function getToken() {
  return localStorage.getItem('auth_token') || '';
}

// 设置认证 token
window.setAuthToken = function (token) {
  localStorage.setItem('auth_token', token)
  supabase.auth.setSession({
    access_token: token,
    refresh_token: ''
  })
}

// 学生相关 API
window.studentsAPI = {
  async list() {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return { students: data }
  },

  async create(data) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const { data, error } = await supabase
      .from('students')
      .insert({ ...data, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return { student: data }
  },

  async update(id, data) {
    const { data: result, error } = await supabase
      .from('students')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { student: result }
  },

  async delete(id) {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  }
}

// 科目相关 API
window.subjectsAPI = {
  async list() {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    return { subjects: data }
  },

  async create(data) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const { data, error } = await supabase
      .from('subjects')
      .insert({ ...data, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return { subject: data }
  },

  async update(id, data) {
    const { data: result, error } = await supabase
      .from('subjects')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { subject: result }
  },

  async delete(id) {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  }
}

// 规划相关 API
window.plansAPI = {
  async list(params = {}) {
    let query = supabase
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

    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) throw error
    return { plans: data }
  },

  async create(data) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const { data: result, error } = await supabase
      .from('homework_plans')
      .insert({ ...data, user_id: userId })
      .select(`
        *,
        student:students(id, name, grade),
        subject:subjects(id, name, icon)
      `)
      .single()

    if (error) throw error
    return { plan: result }
  },

  async update(id, data) {
    const { data: result, error } = await supabase
      .from('homework_plans')
      .update(data)
      .eq('id', id)
      .select(`
        *,
        student:students(id, name, grade),
        subject:subjects(id, name, icon)
      `)
      .single()

    if (error) throw error
    return { plan: result }
  },

  async toggleComplete(id, isCompleted) {
    return this.update(id, { is_completed: isCompleted })
  },

  async delete(id) {
    const { error } = await supabase
      .from('homework_plans')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  }
}

// 批改相关 API
window.reportsAPI = {
  async list(params = {}) {
    let query = supabase
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

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return { reports: data }
  },

  async get(id) {
    const { data, error } = await supabase
      .from('homework_reports')
      .select(`
        *,
        student:students(id, name, grade),
        subject:subjects(id, name, icon)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return { report: data }
  },

  async delete(id) {
    const { error } = await supabase
      .from('homework_reports')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  }
}

// 总结相关 API
window.summariesAPI = {
  async get(date) {
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('summary_date', date)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return { summary: data || null }
  },

  async generate(date) {
    const { count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })

    const { data: plans } = await supabase
      .from('homework_plans')
      .select(`*, subject:subjects(id, name)`)
      .eq('plan_date', date)

    const { data: reports } = await supabase
      .from('homework_reports')
      .select(`*, subject:subjects(id, name)`)
      .eq('plan_date', date)

    const subjectStats = {}
    if (plans) {
      plans.forEach(p => {
        const name = p.subject?.name || '未知'
        if (!subjectStats[name]) {
          subjectStats[name] = { name, total: 0, completed: 0, accuracies: [] }
        }
        subjectStats[name].total++
        if (p.is_completed) subjectStats[name].completed++
      })
    }

    const completedStudents = new Set(
      plans?.filter(p => p.is_completed).map(p => p.student_id) || []
    ).size

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const avgAccuracy = reports?.length > 0
      ? Math.round(reports.reduce((a, r) => a + (r.accuracy || 0), 0) / reports.length)
      : 0

    const detailText = `今日共${totalStudents || 0}名学生，${completedStudents}人完成作业。`

    return {
      summary: {
        summary_date: date,
        user_id: userId,
        total_students: totalStudents || 0,
        completed_count: completedStudents,
        avg_accuracy: avgAccuracy,
        subject_summary: Object.values(subjectStats),
        detail_text: detailText,
        copy_text: detailText
      }
    }
  }
}