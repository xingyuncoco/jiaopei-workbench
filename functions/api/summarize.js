// Cloudflare Pages Functions：MiniMax-M3 周总结生成代理
// 路由：/api/summarize
// 安全设计：
//   1. MiniMax key 只存在于 Cloudflare 后台环境变量 MINIMAX_API_KEY，前端不可见
//   2. 调用前校验 Supabase 登录态，防止匿名刷额度

const SUPABASE_URL = 'https://itcrmmkpblayymqvyzaf.supabase.co';
// publishable key 属公开信息（与前端一致），仅用于校验登录态
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZXRrPVhLS6CvOQV5JYnBmA_0PiaL0xT';
const MINIMAX_ENDPOINT = 'https://api.minimax.cn/anthropic/v1/messages';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

// 对接自检：只报告 key 是否配置，不泄露 key 本身
export function onRequestGet(context) {
  return json({ configured: Boolean(context.env.MINIMAX_API_KEY) });
}

const SYSTEM_PROMPT_DAILY = [
  '你是一名教培机构的资深班主任，正在写今天给家长群的全班作业情况通报。',
  '要求：',
  '1. 语气积极正面，像在家长群发消息；',
  '2. 开头一句总体情况概括（完成率、涉及科目数），不要堆数据；',
  '3. 突出表扬完成率较高的学生（按学号或姓名列出 3-5 个），不要点名批评；',
  '4. 指出 1-2 个需要家长配合的共性问题（如某科正确率偏低、某科完成度差），并给出具体家庭建议；',
  '5. 200 字以内，自然分段，不使用 markdown 符号和表情。'
].join('');

const SYSTEM_PROMPT_WEEKLY = [
  '你是一名教培机构的资深老师，根据机构提供的数据给学生家长写本周学习反馈。',
  '要求：',
  '1. 语气亲切专业，像和家长面对面沟通；',
  '2. 先肯定进步（如有），再指出问题；',
  '3. 每个问题必须配一条具体、可操作的家庭配合建议；',
  '4. 数据中提供了薄弱点描述时必须结合它展开，禁止空泛套话；',
  '5. 300 字以内，自然分段，不使用 markdown 符号和表情。'
].join('');

// 日常总结：按日数据
function buildDailyPrompt(p) {
  const lines = [];
  lines.push(`日期：${p.date}`);
  if (p.subjects && p.subjects.length) {
    lines.push('各科今日作业情况：');
    p.subjects.forEach(s => {
      const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
      lines.push(`- ${s.subject}：布置${s.total}次，完成${s.completed}次（${pct}%）`);
    });
  } else {
    lines.push('今日无作业数据。');
  }
  if (p.students && p.students.length) {
    lines.push('逐生完成情况：');
    p.students.forEach(s => {
      const acc = s.avg_accuracy === null ? '未批改' : `正确率${s.avg_accuracy}%`;
      lines.push(`- ${s.student}：完成${s.completed}/${s.total}，${acc}`);
    });
  }
  return lines.join('\n');
}

// 周总结：按学生学情
function buildWeeklyPrompt(p) {
  const lines = [];
  lines.push(`学生：${p.student_name}（${p.grade || '年级未填'}）`);
  if (p.enrolled_at) lines.push(`入学日期：${p.enrolled_at}`);
  lines.push(`总结周期：${p.week_start} 至 ${p.week_end}`);

  if (p.week_stats && p.week_stats.length) {
    lines.push('本周作业数据：');
    p.week_stats.forEach(s => {
      const acc = s.avg_accuracy === null ? '未批改' : `平均正确率${s.avg_accuracy}%`;
      lines.push(`- ${s.subject}：布置${s.total}次，完成${s.completed}次，${acc}`);
    });
  } else {
    lines.push('本周作业数据：无记录');
  }

  if (p.assessments && p.assessments.length) {
    lines.push('学情评估记录（含入学基线）：');
    p.assessments.forEach(a => {
      const weak = a.weak_points ? `，薄弱点：${a.weak_points}` : '';
      lines.push(`- ${a.subject} [${a.type}] ${a.date} 水平${a.level}级（1入门-5优秀）${weak}`);
    });
  } else {
    lines.push('学情评估记录：暂无');
  }

  lines.push('请输出本周给家长的反馈。');
  return lines.join('\n');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.MINIMAX_API_KEY) {
    return json({ error: '服务端未配置 MINIMAX_API_KEY，请到 Cloudflare 后台 Settings → Environment variables 添加' }, 500);
  }

  // 登录态校验：未登录直接拒绝，避免额度被匿名消耗
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: '未登录' }, 401);

  const authCheck = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!authCheck.ok) return json({ error: '登录已失效，请重新登录' }, 401);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  // 根据 mode 选择对应的提示词
  const mode = payload?.mode || 'weekly';
  const system = mode === 'daily' ? SYSTEM_PROMPT_DAILY : SYSTEM_PROMPT_WEEKLY;
  const userPrompt = mode === 'daily' ? buildDailyPrompt(payload) : buildWeeklyPrompt(payload);

  let resp;
  try {
    resp = await fetch(MINIMAX_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.MINIMAX_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'MiniMax-M3',
        max_tokens: 1024,
        temperature: 1,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: userPrompt }] }]
      })
    });
  } catch (e) {
    return json({ error: '调用 MiniMax 网络异常', detail: String(e) }, 502);
  }

  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 300);
    return json({ error: `MiniMax 调用失败（HTTP ${resp.status}）`, detail }, 502);
  }

  const data = await resp.json();
  // M3 默认关闭 thinking，这里仍按类型过滤，只取文本块
  const text = (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  if (!text) return json({ error: 'MiniMax 返回为空', detail: JSON.stringify(data).slice(0, 300) }, 502);

  return json({ summary: text });
}
