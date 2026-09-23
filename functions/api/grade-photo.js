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
  '你是一位资深的中小学辅导老师。你会收到一张学生作业照片。',
  '请仔细批改，并严格按照以下 JSON 格式返回结果（不要返回其他内容）：',
  '',
  '{',
  '  "correct_count": 正确题数,',
  '  "wrong_count": 错误题数,',
  '  "empty_count": 未答题数,',
  '  "total_count": 总题数,',
  '  "accuracy": 正确率(百分比数字),',
  '  "weak_points": ["薄弱点1", "薄弱点2", "薄弱点3"],',
  '  "suggestion": "针对性的学习建议，2-3句话，语气温暖鼓励"',
  '}',
  '',
  '【业务要求】',
  '1. 仔细识别每一道题，判断对(correct)、错(wrong)、还是空白(blank/empty)',
  '2. 如果作业已由老师用红笔批改过，以红笔批改为准',
  '3. weak_points 是科目维度的失分点归纳，最多 3 条',
  '4. 建议要具体、可操作，不要泛泛而谈',
  '5. 如果全对，weak_points 为空数组，suggestion 要表扬鼓励',
  '',
  '【输出格式要求】',
  '- 只输出 JSON 对象，不要 markdown 围栏，不要额外说明',
  '- 第一个字符必须是 {，最后一个字符必须是 }'
].join('\n');

const USER_PROMPT_TEMPLATE = (subject, pageNumber) =>
  `请批改这张作业照片（第 ${pageNumber} 页）。科目：${subject || '未指定'}。请严格按系统提示的 JSON 结构输出，不要加任何额外说明。`;

function safeParseJson(text) {
  const raw = (text || '').trim();
  if (!raw) return null;

  const tryParse = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };

  // 1) 原样
  let r = tryParse(raw); if (r) return r;

  // 2) 去掉 markdown ```json ... ``` 围栏
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fence) { r = tryParse(fence[1].trim()); if (r) return r; }

  // 3) 找最外层 { ... }（按配对深度提取，处理嵌套）
  const first = raw.indexOf('{');
  if (first < 0) return null;
  let depth = 0;
  let last = -1;
  let inStr = false;
  let escape = false;
  for (let i = first; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { last = i; break; } }
  }
  if (last > first) {
    const block = raw.slice(first, last + 1);
    r = tryParse(block); if (r) return r;

    // 4) 常见修复：去掉尾逗号、去掉 // 单行注释
    const fixed = block
      .replace(/,\s*([\]}])/g, '$1')        // ,] / ,}
      .replace(/^\s*\/\/.*$/gm, '')          // 行注释
      .replace(/\/\*[\s\S]*?\*\//g, '');     // 块注释
    r = tryParse(fixed); if (r) return r;
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

  // 确保返回字段完整，兼容旧字段名
  const result = {
    correct_count: parsed_json.correct_count ?? parsed_json.correct ?? parsed_json.total ?? 0,
    wrong_count: parsed_json.wrong_count ?? parsed_json.wrong ?? 0,
    empty_count: parsed_json.empty_count ?? parsed_json.empty ?? parsed_json.blank ?? 0,
    total_count: parsed_json.total_count ?? parsed_json.total ?? 0,
    accuracy: parsed_json.accuracy ?? 0,
    weak_points: parsed_json.weak_points || [],
    suggestion: parsed_json.suggestion || parsed_json.advice || '继续保持！'
  };

  return json({ result });
}