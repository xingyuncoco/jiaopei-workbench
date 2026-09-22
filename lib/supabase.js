import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 服务端 Supabase 客户端（使用 service role key）
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 获取当前用户（从请求头中获取 token）
export async function getUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');

  // 验证 token 并获取用户
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error) return null;
  return user;
}
