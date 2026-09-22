import { supabase, getUser } from '../lib/supabase';

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

  // GET /api/plans - 获取规划列表
  if (method === 'GET') {
    try {
      const { date, student_id } = req.query;

      let query = supabase
        .from('homework_plans')
        .select(`
          *,
          student:students(id, name, grade),
          subject:subjects(id, name, icon)
        `)
        .eq('user_id', user.id);

      if (date) {
        query = query.eq('plan_date', date);
      }

      if (student_id) {
        query = query.eq('student_id', student_id);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ plans: data });
    } catch (error) {
      console.error('获取规划列表失败:', error);
      return res.status(500).json({ error: '获取规划列表失败' });
    }
  }

  // POST /api/plans - 添加规划
  if (method === 'POST') {
    try {
      const { student_id, subject_id, plan_date, start_time, end_time } = req.body;

      if (!student_id || !subject_id) {
        return res.status(400).json({ error: '学生和科目不能为空' });
      }

      const { data, error } = await supabase
        .from('homework_plans')
        .insert({
          user_id: user.id,
          student_id,
          subject_id,
          plan_date: plan_date || new Date().toISOString().split('T')[0],
          start_time,
          end_time
        })
        .select(`
          *,
          student:students(id, name, grade),
          subject:subjects(id, name, icon)
        `)
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: '该规划已存在' });
        }
        throw error;
      }

      return res.status(201).json({ plan: data });
    } catch (error) {
      console.error('添加规划失败:', error);
      return res.status(500).json({ error: '添加规划失败' });
    }
  }

  // PUT /api/plans/:id - 更新规划
  if (method === 'PUT') {
    try {
      const { id } = req.query;
      const { start_time, end_time, is_completed } = req.body;

      const { data, error } = await supabase
        .from('homework_plans')
        .update({
          start_time,
          end_time,
          is_completed
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select(`
          *,
          student:students(id, name, grade),
          subject:subjects(id, name, icon)
        `)
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({ error: '规划不存在或无权限修改' });
      }

      return res.status(200).json({ plan: data });
    } catch (error) {
      console.error('更新规划失败:', error);
      return res.status(500).json({ error: '更新规划失败' });
    }
  }

  // DELETE /api/plans/:id - 删除规划
  if (method === 'DELETE') {
    try {
      const { id } = req.query;

      const { error } = await supabase
        .from('homework_plans')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('删除规划失败:', error);
      return res.status(500).json({ error: '删除规划失败' });
    }
  }

  return res.status(405).json({ error: '不支持的请求方法' });
}
