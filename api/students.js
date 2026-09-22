import { supabase, getUser } from '../lib/supabase';

export default async function handler(req, res) {
  // CORS 头
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

  // GET /api/students - 获取学生列表
  if (method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ students: data });
    } catch (error) {
      console.error('获取学生列表失败:', error);
      return res.status(500).json({ error: '获取学生列表失败' });
    }
  }

  // POST /api/students - 添加学生
  if (method === 'POST') {
    try {
      const { name, grade, group_name, avatar_url } = req.body;

      if (!name) {
        return res.status(400).json({ error: '学生姓名不能为空' });
      }

      const { data, error } = await supabase
        .from('students')
        .insert({
          user_id: user.id,
          name,
          grade: grade || null,
          group_name: group_name || null,
          avatar_url: avatar_url || null
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ student: data });
    } catch (error) {
      console.error('添加学生失败:', error);
      return res.status(500).json({ error: '添加学生失败' });
    }
  }

  // PUT /api/students/:id - 编辑学生
  if (method === 'PUT') {
    try {
      const { id } = req.query;
      const { name, grade, group_name, avatar_url } = req.body;

      const { data, error } = await supabase
        .from('students')
        .update({
          name,
          grade,
          group_name,
          avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({ error: '学生不存在或无权限修改' });
      }

      return res.status(200).json({ student: data });
    } catch (error) {
      console.error('编辑学生失败:', error);
      return res.status(500).json({ error: '编辑学生失败' });
    }
  }

  // DELETE /api/students/:id - 删除学生
  if (method === 'DELETE') {
    try {
      const { id } = req.query;

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('删除学生失败:', error);
      return res.status(500).json({ error: '删除学生失败' });
    }
  }

  return res.status(405).json({ error: '不支持的请求方法' });
}
