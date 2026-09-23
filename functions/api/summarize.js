// Cloudflare Pages Functions：MiniMax-M3 总结生成代理
// 路由：/api/summarize  POST
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

const SYSTEM_PROMPT_HOMEWORK = [
  '你是一名教培机构的资深老师，根据某学生今天各科作业的布置/完成情况，给家长一段作业情况报告。',
  '要求：',
  '1. 语气亲切专业，像和家长面对面沟通；',
  '2. 按科目逐一汇总作业完成率与正确率（如果有），避免堆砌数字；',
  '3. 指出 1-2 个需要家长关注的薄弱点，并给出家庭配合建议；',
  '4. 200 字以内，自然分段，不使用 markdown 符号和表情。'
].join('');

const SYSTEM_PROMPT_DAILY = [
  '你是一名教培机构的资深老师，根据今天该生的作业数据和老师提交的反馈，给家长写一份结构化的日常学习报告。',
  '',
  '【输出格式要求 - 必须严格遵守】',
  '分四个部分，每部分用空行分隔，自然段落，不使用 markdown 符号：',
  '',
  '一、今日学习情况',
  '   - 汇总今天各科作业完成情况与正确率',
  '   - 指出各科存在的薄弱点（如有）',
  '   - 描述孩子的整体表现和状态',
  '',
  '二、老师反馈',
  '   - 引用老师填写的反馈内容',
  '   - 对孩子的具体表现进行点评',
  '',
  '三、明日计划',
  '   - 根据今天的表现制定针对性的学习安排',
  '   - 明确需要重点关注和突破的内容',
  '',
  '四、家庭配合建议',
  '   - 给出 2-3 条具体、可操作的家庭配合行动',
  '   - 如需巩固薄弱点，提供具体的练习方向',
  '',
  '【语气要求】',
  '亲切专业，像和家长面对面沟通；数据有根有据，不空泛套话。'
].join('\n');

const SYSTEM_PROMPT_WEEKLY = [
  '你是一名教培机构的资深老师，根据本周学生的学习数据给家长写一份完整的周总结报告。',
  '',
  '【输出格式要求 - 必须严格遵守】',
  '分四个部分，每部分用空行分隔，自然段落，不使用 markdown 符号：',
  '',
  '一、本周学习情况',
  '   - 按日期顺序概述每天的学习内容与完成情况',
  '   - 汇总本周各科作业布置与完成情况',
  '   - 指出本周出现的主要薄弱点',
  '',
  '二、学情变化分析',
  '   - 对比本周初和周末的学情评估，判断各科目是否有提升/下降/持平',
  '   - 如有提升，肯定孩子的努力；如有下降，分析原因',
  '   - 结合本周每日总结中的老师反馈进行综合分析',
  '',
  '三、老师本周工作回顾',
  '   - 总结本周为孩子做的具体教学工作',
  '   - 对本周教学效果进行客观评价',
  '',
  '四、下周计划与家庭配合建议',
  '   - 制定下周的学习重点和突破方向',
  '   - 给出 2-3 条具体、可操作的家庭配合行动',
  '   - 明确家长需要配合的具体事项',
  '',
  '【数据使用要求】',
  '1. 必须引用输入数据中的具体数字和事实，不捏造',
  '2. 学情变化分析必须基于提供的学情档案对比',
  '3. 每日总结内容必须结合到分析中',
  '4. 禁止空泛套话，每一点都要有数据支撑',
  '',
  '【语气要求】',
  '亲切专业，像和家长面对面沟通；有根有据，让家长放心。'
].join('\n');

// 作业情况：单生按日
function buildHomeworkPrompt(p) {
  const lines = [];
  lines.push(`日期：${p.date}`);
  lines.push(`学生：${p.student_name || '未指定'}${p.grade ? '（' + p.grade + '）' : ''}`);
  if (p.subjects && p.subjects.length) {
    lines.push('各科今日作业情况：');
    p.subjects.forEach(s => {
      const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
      lines.push(`- ${s.subject}：布置${s.total}次，完成${s.completed}次（${pct}%）`);
    });
  } else {
    lines.push('今日无作业数据。');
  }
  return lines.join('\n');
}

// 日常总结：单生按日数据（包含各科详细批改数据）
function buildDailyPrompt(p) {
  const lines = [];
  lines.push(`日期：${p.date}`);
  lines.push(`学生：${p.student_name || '未指定'}${p.grade ? '（' + p.grade + '）' : ''}`);

  // 各科作业详细数据
  if (p.student_reports && p.student_reports.length) {
    lines.push('');
    lines.push('【各科作业批改详情】');
    p.student_reports.forEach(r => {
      const accStr = r.accuracy != null ? `正确率${r.accuracy}%` : '未批改';
      const detail = r.total ? `（${r.correct}对/${r.wrong}错/${r.blank}空）` : '';
      const weakPoints = r.weak_points;
      let weak = '';
      if (weakPoints) {
        if (Array.isArray(weakPoints)) {
          weak = weakPoints.length ? `薄弱点：${weakPoints.join('、')}` : '';
        } else if (typeof weakPoints === 'string') {
          weak = weakPoints ? `薄弱点：${weakPoints}` : '';
        }
      }
      const advice = r.advice ? `建议：${r.advice}` : '';
      lines.push(`- ${r.subject || '未知'}：${accStr} ${detail}`);
      if (weak) lines.push(`  ${weak}`);
      if (advice) lines.push(`  ${advice}`);
    });
  } else if (p.subjects && p.subjects.length) {
    lines.push('各科作业情况：');
    p.subjects.forEach(s => {
      const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
      lines.push(`- ${s.subject}：布置${s.total}次，完成${s.completed}次（${pct}%）`);
    });
  } else {
    lines.push('今日无作业数据。');
  }

  // 薄弱点汇总
  if (p.weak_points && p.weak_points.length) {
    lines.push('');
    lines.push(`【薄弱点汇总】${p.weak_points.join('、')}`);
  }

  // 老师反馈（必写入）
  if (p.teacher_note && p.teacher_note.trim()) {
    lines.push('');
    lines.push(`【老师反馈】${p.teacher_note.trim()}`);
  } else {
    lines.push('');
    lines.push('【老师反馈】未填写');
  }

  return lines.join('\n');
}

// 周总结：按学生学情（包含本周每日详情、学情对比、每日总结）
function buildWeeklyPrompt(p) {
  const lines = [];
  lines.push(`学生：${p.student_name || '未指定'}（${p.grade || '年级未填'}）`);
  if (p.enrolled_at) lines.push(`入学日期：${p.enrolled_at}`);
  lines.push(`总结周期：${p.week_start} 至 ${p.week_end}`);

  // 1. 每日作业完成情况
  if (p.week_daily && p.week_daily.length) {
    lines.push('');
    lines.push('【本周每日作业情况】');
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    p.week_daily.forEach((d, i) => {
      const dayName = dayNames[i] || `Day${i + 1}`;
      const date = d.date?.slice(5) || '';  // 只显示月日
      const status = !d.hasHomework ? '无作业' : (d.completed ? '✓已完成' : '○未完成');
      const acc = d.accuracy != null ? `，正确率${d.accuracy}%` : '';
      lines.push(`- ${dayName}(${date})：${status}${acc}`);
    });
  }

  // 2. 各科本周汇总数据
  if (p.week_stats_by_subject && p.week_stats_by_subject.length) {
    lines.push('');
    lines.push('【本周各科作业汇总】');
    p.week_stats_by_subject.forEach(s => {
      const acc = s.avg_accuracy != null ? `，平均正确率${s.avg_accuracy}%` : '，未批改';
      const weak = s.weak_points && s.weak_points.length ? `，薄弱点：${s.weak_points.join('、')}` : '';
      const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
      lines.push(`- ${s.subject}：完成${s.completed}/${s.total}次（${pct}%）${acc}${weak}`);
    });
  } else {
    lines.push('');
    lines.push('【本周各科作业汇总】无数据');
  }

  // 3. 本周薄弱点汇总
  if (p.week_weak_points && p.week_weak_points.length) {
    lines.push('');
    lines.push(`【本周薄弱点汇总】${p.week_weak_points.join('、')}`);
  }

  // 4. 本周每日总结
  if (p.week_daily_summaries && p.week_daily_summaries.length) {
    lines.push('');
    lines.push('【本周每日老师总结】');
    p.week_daily_summaries.forEach((s, i) => {
      const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
      const dayName = dayNames[i] || `Day${i + 1}`;
      const date = s.period_start?.slice(5) || '';
      const note = s.teacher_note || s.content?.slice(0, 100) || '无总结';
      lines.push(`- ${dayName}(${date})：${note.slice(0, 150)}${note.length > 150 ? '...' : ''}`);
    });
  } else {
    lines.push('');
    lines.push('【本周每日老师总结】暂无');
  }

  // 5. 学情档案对比（入学基线 vs 当前评估）
  if (p.assessments && p.assessments.length) {
    lines.push('');
    lines.push('【学情档案】');
    // 找到最早的（入学基线）和最新的评估
    const sorted = [...p.assessments].sort((a, b) => new Date(a.date) - new Date(b.date));
    const baseline = sorted[0];
    const latest = sorted[sorted.length - 1];

    if (baseline) {
      const weak = baseline.weak_points ? `，薄弱点：${baseline.weak_points}` : '';
      lines.push(`入学评估（${baseline.date}）：${baseline.subject} ${baseline.type} 水平${baseline.level}级${weak}`);
    }
    if (latest && latest !== baseline) {
      const weak = latest.weak_points ? `，薄弱点：${latest.weak_points}` : '';
      lines.push(`最新评估（${latest.date}）：${latest.subject} ${latest.type} 水平${latest.level}级${weak}`);
      if (baseline) {
        const diff = latest.level - baseline.level;
        const change = diff > 0 ? `↑提升${diff}级` : diff < 0 ? `↓下降${Math.abs(diff)}级` : '→持平';
        lines.push(`  → 学情变化：${change}`);
      }
    } else if (latest) {
      lines.push(`当前评估：${latest.subject} 水平${latest.level}级${latest.weak_points ? '，薄弱点：' + latest.weak_points : ''}`);
    }
  } else {
    lines.push('');
    lines.push('【学情档案】暂无评估记录');
  }

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
  const system = mode === 'homework' ? SYSTEM_PROMPT_HOMEWORK
               : mode === 'daily'    ? SYSTEM_PROMPT_DAILY
               :                       SYSTEM_PROMPT_WEEKLY;
  const userPrompt = mode === 'homework' ? buildHomeworkPrompt(payload)
                   : mode === 'daily'    ? buildDailyPrompt(payload)
                   :                       buildWeeklyPrompt(payload);

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