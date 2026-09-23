// 通用的 AI 对话接口
const OnRequest = async (req, res) => {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, stream = false } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // 获取 MiniMax API 配置
    const apiKey = Deno.env.get('MINIMAX_API_KEY');
    const groupId = Deno.env.get('MINIMAX_GROUP_ID');

    if (!apiKey || !groupId) {
      return res.status(500).json({ error: 'API configuration missing' });
    }

    const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_pro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'abab6.5s-chat',
        tokens_to_generate: 1024,
        temperature: 0.7,
        stream: false,
        messages: [
          { role: 'system', content: '你是一位专业的教培机构学情分析专家，回答要专业、温暖、有针对性。' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `API error: ${errorText}` });
    }

    const result = await response.json();

    // 提取 AI 返回的内容
    let content = '';
    if (result.choices && result.choices[0] && result.choices[0].messages) {
      content = result.choices[0].messages[0].text || result.choices[0].messages[0].content || '';
    }

    return res.status(200).json({ content });

  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export { OnRequest };
