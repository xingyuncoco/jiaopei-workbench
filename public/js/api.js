/**
 * 直接使用 Supabase JavaScript SDK
 * 浏览器端直接连接数据库
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase 配置 - 从 localStorage 或硬编码获取
const supabaseUrl = 'https://itcrmmkpblayymqvyzaf.supabase.co'
const supabaseAnonKey = localStorage.getItem('supabase_anon_key') || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 获取 token（从 localStorage）
function getToken() {
  return localStorage.getItem('auth_token') || '';
}

// 设置认证 token
export function setAuthToken(token) {
  localStorage.setItem('auth_token', token)
  supabase.auth.setSession({
    access_token: token,
    refresh_token: ''
  })
}

// =============================================
// 学生相关 API
// =============================================

export const studentsAPI = {
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

// =============================================
// 科目相关 API
// =============================================

export const subjectsAPI = {
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

// =============================================
// 规划相关 API
// =============================================

export const plansAPI = {
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

// =============================================
// 批改相关 API（简化版，无 AI）
// =============================================

export const reportsAPI = {
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

// =============================================
// 总结相关 API
// =============================================

export const summariesAPI = {
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
    // 获取统计数据
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

    // 统计
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

    // 生成总结
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const avgAccuracy = reports?.length > 0
      ? Math.round(reports.reduce((a, r) => a + (r.accuracy || 0), 0) / reports.length)
      : 0

    const detailText = `今日共${totalStudents || 0}名学生，${completedStudents}人完成作业。`

    const copyText = `【今日学习总结 ${date}】

👥 学生情况：
在册 ${totalStudents || 0} 人，完成作业 ${completedStudents} 人

📊 各科完成情况：
${Object.values(subjectStats).map(s => `${s.name}：${s.completed}/${s.total}`).join('\n')}

💡 ${detailText}`

    const { data, error } = await supabase
      .from('daily_summaries')
      .upsert({
        user_id: userId,
        summary_date: date,
        total_students: totalStudents || 0,
        completed_count: completedStudents,
        avg_accuracy: avgAccuracy,
        subject_summary: Object.values(subjectStats),
        detail_text: detailText,
        copy_text: copyText
      }, { onConflict: 'user_id,summary_date' })
      .select()
      .single()

    if (error) throw error
    return { summary: data, copy_text: copyText }
  }
}

// 导出 api 对象（兼容原有代码）
window.api = {
  students: studentsAPI,
  subjects: subjectsAPI,
  plans: plansAPI,
  reports: reportsAPI,
  summaries: summariesAPI
}
