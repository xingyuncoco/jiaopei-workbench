import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.minimax.cn/anthropic',
});

/**
 * 使用 MiniMax-M3 批改作业图片
 * @param {string} imageUrl - 作业图片URL
 * @param {string} studentName - 学生姓名
 * @param {string} subjectName - 科目名称
 * @returns {Promise<Object>} 批改结果
 */
export async function correctHomework(imageUrl, studentName, subjectName) {
  const systemPrompt = `你是一位经验丰富的教培机构老师。你会收到学生作业的照片。
请仔细批改，并严格按照以下JSON格式返回结果（不要返回其他内容）：

{
  "correct_count": 正确题数,
  "total_count": 总题数,
  "accuracy": 正确率(百分比数字),
  "errors": [
    {
      "question_number": "题号",
      "student_answer": "学生答案",
      "correct_answer": "正确答案",
      "analysis": "简短分析（造成错误的原因）"
    }
  ],
  "suggestion": "针对性的学习建议，2-3句话，语气温暖鼓励"
}

要求：
1. 仔细识别每一道题，判断对错
2. 如果作业已由老师用红笔批改过，以红笔批改为准
3. 建议要具体、可操作，不要泛泛而谈
4. 如果全对，errors为空数组，suggestion要表扬`;

  const userMessage = `请批改${studentName}的${subjectName}作业：

作业图片：${imageUrl}`;

  try {
    const response = await anthropic.messages.create({
      model: 'MiniMax-M3',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userMessage
            },
            {
              type: 'image',
              source: {
                type: 'url',
                url: imageUrl
              }
            }
          ]
        }
      ]
    });

    // 解析返回的 JSON
    const resultText = response.content[0].text;
    const result = JSON.parse(resultText);

    return result;
  } catch (error) {
    console.error('MiniMax-M3 批改失败:', error);
    throw new Error('作业批改失败，请重试');
  }
}

/**
 * 生成每日总结
 * @param {Object} data - 汇总数据
 * @returns {Promise<string>} 总结文本
 */
export async function generateDailySummary(data) {
  const { totalStudents, presentStudents, subjectStats, commonErrors } = data;

  const systemPrompt = `你是一位经验丰富的教培机构班主任。请根据提供的数据生成一份简洁温暖的每日总结，用于发送给家长群。

要求：
1. 语言简洁温暖，像老师在跟家长说话
2. 突出重点，不要面面俱到
3. 包含鼓励性的话语
4. 提出具体的改进建议
5. 格式要便于微信阅读`;

  const userMessage = `请生成今日总结：

学生情况：
- 在册学生：${totalStudents}人
- 今日到课：${presentStudents}人

作业完成情况：
${subjectStats.map(s => `- ${s.name}：完成${s.completed}/${s.total}，正确率${s.accuracy}%`).join('\n')}

常见错题：
${commonErrors.map(e => `- ${e.subject}：${e.description}`).join('\n')}`;

  try {
    const response = await anthropic.messages.create({
      model: 'MiniMax-M3',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('生成总结失败:', error);
    throw new Error('总结生成失败，请重试');
  }
}
