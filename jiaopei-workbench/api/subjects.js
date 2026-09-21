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

  // GET /api/subjects - 获取科目列表
  if (method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ subjects: data });
    } catch (error) {
      console.error('获取科目列表失败:', error);
      return res.status(500).json({ error: '获取科目列表失败' });
    }
  }

  // POST /api/subjects - 添加科目
  if (method === 'POST') {
    try {
      const { name, icon } = req.body;

      if (!name) {
        return res.status(400).json({ error: '科目名称不能为空' });
      }

      const { data, error } = await supabase
        .from('subjects')
        .insert({
          user_id: user.id,
          name,
          icon: icon || '📝'
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: '该科目已存在' });
        }
        throw error;
      }

      return res.status(201).json({ subject: data });
    } catch (error) {
      console.error('添加科目失败:', error);
      return res.status(500).json({ error: '添加科目失败' });
    }
  }

  // PUT /api/subjects/:id - 编辑科目
  if (method === 'PUT') {
    try {
      const { id } = req.query;
      const { name, icon } = req.body;

      const { data, error } = await supabase
        .from('subjects')
        .update({ name, icon })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({ error: '科目不存在或无权限修改' });
      }

      return res.status(200).json({ subject: data });
    } catch (error) {
      console.error('编辑科目失败:', error);
      return res.status(500).json({ error: '编辑科目失败' });
    }
  }

  // DELETE /api/subjects/:id - 删除科目
  if (method === 'DELETE') {
    try {
      const { id } = req.query;

      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('删除科目失败:', error);
      return res.status(500).json({ error: '删除科目失败' });
    }
  }

  return res.status(405).json({ error: '不支持的请求方法' });
}
