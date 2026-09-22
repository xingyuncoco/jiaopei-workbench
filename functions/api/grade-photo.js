// Cloudflare Pages Functions：MiniMax-M3 多模态拍照批改
// 路由：/api/grade-photo  POST (application/json)
// 请求体：{ imageBase64: "data:image/jpeg;base64,...", subject: "数学", pageNumber: 1 }
// 响应：{ result: { questions: [...], summary, weak_points, advice, correct, wrong, blank, total } }

const SUPABASE_URL = 'https://itcrmmkpblayymqvyzaf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZXRrPVhLS6CvOQV5JYnBmA_0PiaL0xT';
const MINIMAX_ENDPOINT = 'https://api.minimax.cn/anthropic/v1/messages';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

// 解析 base64（前端会传 data:image/jpeg;base64,XXX 形式）
function parseBase64(input) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(input || '');
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

const SYSTEM_PROMPT = [
  '你是一位资深的中小学辅导老师，专长是给学生批改作业。',
  '老师会上传一张学生作业照片（可能是数学、英语、物理、化学、语文等任意学科）。', '你的任务是分析照片内容，给出结构化的批改结果。',
  '',
  '严格按 JSON 输出，不要加 markdown、不要加任何说明文字。字段：',
  '{',
  '  "questions": [',
  '    {',
  '      "index": 1,  // 题目序号，从 1 开始',
  '      "status": "correct" | "wrong" | "blank",  // 状态：做对 / 做错 / 未做',
  '      "student_answer": "学生的答案（空则写空字符串）",',
  '      "correct_answer": "标准答案（仅在 wrong 或 blank 时填写）",',
  '      "process": "学生的解题过程或步骤概述（仅在可识别时）",',
  '      "wrong_reason": "错因分析（仅 wrong 时填写：知识漏洞 / 粗心 / 步骤漏写 等）"',
  '    }',
  '  ],',
  '  "total": 总题数,',
  '  "correct": 做对的数量,',
  '  "wrong": 做错的数量,',
  '  "blank": 未做的数量,',
  '  "weak_points": ["薄弱知识点 1", "薄弱知识点 2"],',
  '  "advice": "给老师的简短教学建议（一句话）"',
  '}',
  '',
  '要求：',
  '1. 仔细看清每道题；2. 模糊不清就合理推断，不要瞎猜；',
  '3. 如果完全看不清题目，questions 输出空数组，total/correct/wrong/blank 都设为 0；',
  '4. weak_points 是科目维度的失分点归纳，最多 3 条；',
  '5. advice 简短具体，给老师讲题用，**不写给家长看的总结**。'
].join('\n');

const USER_PROMPT_TEMPLATE = (subject, pageNumber) =>
  `请批改这张作业照片（第 ${pageNumber} 页）。科目：${subject || '未指定'}。请严格按系统提示的 JSON 结构输出，不要加任何额外说明。`;

function safeParseJson(text) {
  // 模型偶尔会包 markdown ```json ... ```，先尝试直接 parse，失败则尝试剥离
  const trimmed = (text || '').trim();
  try { return JSON.parse(trimmed); } catch (_) {}
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch (_) {}
  }
  // 兜底：找首个 { 和末个 } 之间的内容
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch (_) {}
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.MINIMAX_API_KEY) {
    return json({ error: '服务端未配置 MINIMAX_API_KEY' }, 500);
  }

  // 登录态校验
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: '未登录' }, 401);

  const authCheck = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!authCheck.ok) return json({ error: '登录已失效' }, 401);

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: '请求体不是合法 JSON' }, 400); }

  const { imageBase64, subject, pageNumber } = payload;
  const parsed = parseBase64(imageBase64);
  if (!parsed) {
    return json({ error: 'imageBase64 必须为 data:image/xxx;base64,XXX 格式' }, 400);
  }
  // 文档限制：单张最大 10MB（base64 编码后约 13.3MB 字符）
  const sizeMB = (parsed.data.length * 3) / 4 / 1024 / 1024;
  if (sizeMB > 10) {
    return json({ error: `图片过大（${sizeMB.toFixed(1)}MB），单张上限 10MB` }, 413);
  }

  const userText = USER_PROMPT_TEMPLATE(subject || '未指定', pageNumber || 1);

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
        max_tokens: 2048,
        temperature: 0.4,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data } },
            { type: 'text', text: userText }
          ]
        }]
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
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  if (!text) return json({ error: 'MiniMax 返回为空', detail: JSON.stringify(data).slice(0, 300) }, 502);

  const parsed_json = safeParseJson(text);
  if (!parsed_json) {
    return json({ error: 'AI 返回的不是合法 JSON', raw: text.slice(0, 500) }, 502);
  }

  return json({ result: parsed_json });
}