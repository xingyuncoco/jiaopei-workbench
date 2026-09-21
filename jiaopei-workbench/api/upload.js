import { supabase, getUser } from '../lib/supabase';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = await getUser(req);

  if (!user) {
    return res.status(401).json({ error: '未授权访问' });
  }

  if (req.method === 'POST') {
    try {
      // 获取 FormData
      const formData = await req.body;

      if (!formData || !formData.file) {
        return res.status(400).json({ error: '请上传文件' });
      }

      const file = formData.file;
      const buffer = Buffer.from(file);
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // 上传到 Supabase Storage
      const { data, error } = await supabase.storage
        .from('homework-images')
        .upload(fileName, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('上传失败:', error);
        return res.status(500).json({ error: '文件上传失败' });
      }

      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from('homework-images')
        .getPublicUrl(data.Key);

      return res.status(200).json({
        success: true,
        url: urlData.publicUrl
      });
    } catch (error) {
      console.error('上传处理失败:', error);
      return res.status(500).json({ error: '上传处理失败' });
    }
  }

  return res.status(405).json({ error: '不支持的请求方法' });
}
