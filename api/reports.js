import { supabase, getUser } from '../lib/supabase';
import { correctHomework } from '../lib/minimax';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = await getUser(req);

  if (!user) {
    return res.status(401).json({ error: '未授权访问' });
  }

  const { method } = req;

  // GET /api/reports - 获取报告列表
  if (method === 'GET') {
    try {
      const { student_id, date } = req.query;

      let query = supabase
        .from('homework_reports')
        .select(`
          *,
          student:students(id, name, grade),
          subject:subjects(id, name, icon)
        `)
        .eq('user_id', user.id);

      if (student_id) {
        query = query.eq('student_id', student_id);
      }

      if (date) {
        query = query.eq('plan_date', date);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ reports: data });
    } catch (error) {
      console.error('获取报告列表失败:', error);
      return res.status(500).json({ error: '获取报告列表失败' });
    }
  }

  // POST /api/reports - 上传图片并批改
  if (method === 'POST') {
    try {
      const { student_id, subject_id, plan_date, image_url } = req.body;

      if (!student_id || !subject_id || !image_url) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      // 获取学生和科目信息
      const { data: student } = await supabase
        .from('students')
        .select('name')
        .eq('id', student_id)
        .single();

      const { data: subject } = await supabase
        .from('subjects')
        .select('name')
        .eq('id', subject_id)
        .single();

      if (!student || !subject) {
        return res.status(400).json({ error: '学生或科目不存在' });
      }

      // 调用 AI 批改
      const correction = await correctHomework(
        image_url,
        student.name,
        subject.name
      );

      // 生成报告文本
      const reportText = `【${student.name} 作业批改报告】${plan_date || new Date().toISOString().split('T')[0]}
${subject.icon} ${subject.name}
📊 正确率：${correction.accuracy}%（${correction.correct_count}/${correction.total_count}）

${correction.errors && correction.errors.length > 0 ? '❌ 错题分析：\n' + correction.errors.map(e =>
  `第${e.question_number}题
  学生答案：${e.student_answer}
  正确答案：${e.correct_answer}
  分析：${e.analysis}`
).join('\n\n') : '✅ 全部正确，继续保持！'}

💡 建议：${correction.suggestion}`;

      // 保存报告到数据库
      const { data, error } = await supabase
        .from('homework_reports')
        .insert({
          user_id: user.id,
          student_id,
          subject_id,
          plan_date: plan_date || new Date().toISOString().split('T')[0],
          image_url,
          correct_count: correction.correct_count,
          total_count: correction.total_count,
          accuracy: correction.accuracy,
          errors_detail: correction.errors || [],
          suggestion: correction.suggestion,
          full_report: reportText
        })
        .select(`
          *,
          student:students(id, name, grade),
          subject:subjects(id, name, icon)
        `)
        .single();

      if (error) throw error;

      return res.status(201).json({ report: data, copy_text: reportText });
    } catch (error) {
      console.error('批改失败:', error);
      return res.status(500).json({ error: error.message || '批改失败，请重试' });
    }
  }

  // GET /api/reports/:id - 获取单条报告
  if (method === 'GET' && req.query.id) {
    try {
      const { id } = req.query;

      const { data, error } = await supabase
        .from('homework_reports')
        .select(`
          *,
          student:students(id, name, grade),
          subject:subjects(id, name, icon)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({ error: '报告不存在' });
      }

      return res.status(200).json({ report: data });
    } catch (error) {
      console.error('获取报告详情失败:', error);
      return res.status(500).json({ error: '获取报告详情失败' });
    }
  }

  // DELETE /api/reports/:id - 删除报告
  if (method === 'DELETE') {
    try {
      const { id } = req.query;

      const { error } = await supabase
        .from('homework_reports')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('删除报告失败:', error);
      return res.status(500).json({ error: '删除报告失败' });
    }
  }

  return res.status(405).json({ error: '不支持的请求方法' });
}
