// Cloudflare Pages Functions：作业情况 AI 报告生成（家长视角）
// 路由：/api/homework-report  POST (application/json)
// 请求体：{ date, student_name, grade, subjects: [{ subject, accuracy, weak_points, advice, total, correct, wrong, blank }] }
// 响应：{ summary: "给家长看的一段文字" }

const MINIMAX_ENDPOINT = 'https://api.minimax.cn/anthropic/v1/messages';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

const SYSTEM_PROMPT = [
  '你是一位经验丰富的中小学辅导老师，正在为家长写当天的"作业情况反馈"。',
  '输入数据来自今天该学生每一科的拍照批改结果（已完成按科目合并多次批改）。',
  '',
  '【输出格式硬性要求】',
  '- 只输出中文短文，200~300 字之间。',
  '- 不要 markdown 围栏、不要 JSON、不要列表编号。',
  '- 自然段形式，2~4 段。',
  '',
  '【内容要求】',
  '- 第一段：今天作业的整体表现（总题数 / 准确率），给一个总体评价。',
  '- 第二段：按科目逐一简述，**只点出薄弱点**，不重复罗列全部对错。',
  '- 第三段（可选）：给家长 1~2 条具体可执行的建议。',
  '- 语气温和、专业、让家长放心，不要堆砌形容词。',
  '- **禁止捏造数据**：只能引用输入里给出的科目和数字，没提到的科目不要提。'
].join('\n');

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.MINIMAX_API_KEY) {
    return json({ error: '服务端未配置 MINIMAX_API_KEY' }, 500);
  }

  // 登录态校验
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: '未登录' }, 401);

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: '请求体不是合法 JSON' }, 400); }

  const { date, student_name, grade, subjects } = payload;
  if (!student_name || !Array.isArray(subjects)) {
    return json({ error: '请求体缺少 student_name 或 subjects' }, 400);
  }
  if (subjects.length === 0) {
    return json({ summary: `今天 ${student_name} 还没有批改记录。` });
  }

  // 组装 prompt：把每科合并后的结果整理成结构化文本
  const subjectLines = subjects.map(s => {
    const weak = (s.weak_points && s.weak_points.length) ? s.weak_points.join('；') : '无明显薄弱点';
    const advice = s.advice ? s.advice : '继续保持';
    return [
      `【${s.subject}】共 ${s.total} 题，对 ${s.correct} 错 ${s.wrong} 空 ${s.blank}，准确率 ${s.accuracy}%`,
      `  薄弱点：${weak}`,
      `  老师建议：${advice}`
    ].join('\n');
  }).join('\n');

  const userPrompt = [
    `学生：${student_name}${grade ? `（${grade}）` : ''}`,
    `日期：${date}`,
    '',
    '【今日各科批改数据】',
    subjectLines,
    '',
    '请按系统提示写一段给家长看的作业情况反馈。'
  ].join('\n');

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
        temperature: 0.6,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
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
    .join('')
    .trim();

  if (!text) return json({ error: 'MiniMax 返回为空' }, 502);

  return json({ summary: text });
}
