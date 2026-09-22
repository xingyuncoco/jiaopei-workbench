import { supabase, getUser } from '../lib/supabase';
import { generateDailySummary } from '../lib/minimax';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = await getUser(req);

  if (!user) {
    return res.status(401).json({ error: '未授权访问' });
  }

  const { method } = req;

  // GET /api/summaries - 获取指定日期的总结
  if (method === 'GET') {
    try {
      const { date } = req.query;

      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('summary_date', date || new Date().toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return res.status(200).json({ summary: data || null });
    } catch (error) {
      console.error('获取总结失败:', error);
      return res.status(500).json({ error: '获取总结失败' });
    }
  }

  // POST /api/summaries/generate - 生成今日总结
  if (method === 'POST') {
    try {
      const { date } = req.body;
      const targetDate = date || new Date().toISOString().split('T')[0];

      // 获取学生总数
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 获取今日规划完成情况
      const { data: plans } = await supabase
        .from('homework_plans')
        .select(`
          *,
          subject:subjects(id, name, icon)
        `)
        .eq('user_id', user.id)
        .eq('plan_date', targetDate);

      // 获取今日批改报告
      const { data: reports } = await supabase
        .from('homework_reports')
        .select(`
          *,
          subject:subjects(id, name)
        `)
        .eq('user_id', user.id)
        .eq('plan_date', targetDate);

      // 统计各科情况
      const subjectStats = {};
      const commonErrors = [];

      if (reports && reports.length > 0) {
        reports.forEach(report => {
          const subjectName = report.subject?.name || '未知科目';
          if (!subjectStats[subjectName]) {
            subjectStats[subjectName] = {
              name: subjectName,
              total: 0,
              completed: 0,
              accuracies: []
            };
          }
          subjectStats[subjectName].completed++;
          subjectStats[subjectName].accuracies.push(report.accuracy);

          // 收集错题
          if (report.errors_detail && report.errors_detail.length > 0) {
            report.errors_detail.forEach(err => {
              commonErrors.push({
                subject: subjectName,
                description: `第${err.question_number}题：${err.analysis}`
              });
            });
          }
        });
      }

      // 统计规划完成情况
      if (plans && plans.length > 0) {
        plans.forEach(plan => {
          const subjectName = plan.subject?.name || '未知科目';
          if (!subjectStats[subjectName]) {
            subjectStats[subjectName] = {
              name: subjectName,
              total: 0,
              completed: 0,
              accuracies: []
            };
          }
          subjectStats[subjectName].total++;
          if (plan.is_completed) {
            subjectStats[subjectName].completed++;
          }
        });
      }

      // 计算平均正确率
      const allAccuracies = Object.values(subjectStats).flatMap(s => s.accuracies);
      const avgAccuracy = allAccuracies.length > 0
        ? Math.round(allAccuracies.reduce((a, b) => a + b, 0) / allAccuracies.length)
        : 0;

      // 计算完成人数
      const completedStudents = new Set(
        plans?.filter(p => p.is_completed).map(p => p.student_id) || []
      ).size;

      // 准备生成总结的数据
      const summaryData = {
        totalStudents: totalStudents || 0,
        presentStudents: completedStudents,
        subjectStats: Object.values(subjectStats).map(s => ({
          ...s,
          accuracy: s.accuracies.length > 0
            ? Math.round(s.accuracies.reduce((a, b) => a + b, 0) / s.accuracies.length)
            : 0
        })),
        commonErrors: commonErrors.slice(0, 5)
      };

      // 调用 AI 生成总结
      let detailText = '';
      let copyText = '';

      try {
        detailText = await generateDailySummary(summaryData);

        // 生成一键复制文本
        copyText = `【今日学习总结 ${targetDate}】

👥 学生情况：
在册 ${totalStudents} 人，今日完成作业 ${completedStudents} 人

📊 各科完成情况：
${summaryData.subjectStats.map(s =>
  `${s.name}：完成 ${s.completed}/${s.total}，正确率 ${s.accuracy}%`
).join('\n')}

${detailText}`;
      } catch (aiError) {
        console.error('AI 生成总结失败，使用默认文本:', aiError);
        detailText = '今日学习情况良好，同学们都表现不错！';
        copyText = `【今日学习总结 ${targetDate}】

👥 学生情况：
在册 ${totalStudents} 人，今日完成作业 ${completedStudents} 人

📊 各科完成情况：
${summaryData.subjectStats.map(s =>
  `${s.name}：完成 ${s.completed}/${s.total}，正确率 ${s.accuracy}%`
).join('\n')}

💡 ${detailText}`;
      }

      // 保存或更新总结
      const { data, error } = await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          summary_date: targetDate,
          total_students: totalStudents || 0,
          completed_count: completedStudents,
          avg_accuracy: avgAccuracy,
          subject_summary: summaryData.subjectStats,
          detail_text: detailText,
          copy_text: copyText
        }, {
          onConflict: 'user_id,summary_date'
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        summary: data,
        copy_text: copyText
      });
    } catch (error) {
      console.error('生成总结失败:', error);
      return res.status(500).json({ error: '生成总结失败' });
    }
  }

  // PUT /api/summaries/:id - 编辑总结
  if (method === 'PUT') {
    try {
      const { id } = req.query;
      const { detail_text, copy_text } = req.body;

      const { data, error } = await supabase
        .from('daily_summaries')
        .update({ detail_text, copy_text })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({ error: '总结不存在或无权限修改' });
      }

      return res.status(200).json({ summary: data });
    } catch (error) {
      console.error('编辑总结失败:', error);
      return res.status(500).json({ error: '编辑总结失败' });
    }
  }

  return res.status(405).json({ error: '不支持的请求方法' });
}
