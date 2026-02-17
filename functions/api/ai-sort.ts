interface Env {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // Auth check
    if (env.PASSWORD && env.PASSWORD.trim()) {
      const providedPassword = request.headers.get('x-auth-password') || '';
      if (providedPassword !== env.PASSWORD) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    const body = await request.json() as {
      links: any[];
      categories: any[];
    };

    if (!Array.isArray(body.links) || !Array.isArray(body.categories)) {
      return json({ error: 'Invalid request: links and categories are required' }, 400);
    }

    // Read AI config from KV
    const aiConfigStr = await env.CLOUDNAV_KV.get('ai_config');
    if (!aiConfigStr) {
      return json({ error: '请先在设置 → AI 排序中配置 API 地址、Key 和模型' }, 400);
    }

    let aiConfig: { apiUrl?: string; apiKey?: string; model?: string };
    try {
      aiConfig = JSON.parse(aiConfigStr);
    } catch {
      return json({ error: 'AI 配置格式错误' }, 400);
    }

    if (!aiConfig.apiUrl || !aiConfig.apiKey || !aiConfig.model) {
      return json({ error: '请先在设置 → AI 排序中完整配置 API 地址、Key 和模型' }, 400);
    }

    // Build API URL
    let apiUrl = aiConfig.apiUrl.trim();
    if (!apiUrl.endsWith('/chat/completions')) {
      if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
      if (!apiUrl.endsWith('/v1')) apiUrl += '/v1';
      apiUrl += '/chat/completions';
    }

    // Build prompts
    const systemPrompt = `你是一个书签整理助手。用户会给你一组书签链接（包含 title、url、description、categoryId）和现有分类列表。

你的任务：
1. 分析每个书签的 title、url、description，判断它最适合归入哪个分类
2. categoryId 为 "common"（常用推荐）的书签不要移动，保持原样
3. 如果现有分类不足以覆盖某些书签，你可以创建新分类
4. 对同一分类下的书签按相关性进行排序

返回格式为 JSON：
{
  "links": [
    { "id": "原始id", "categoryId": "目标分类id", "order": 排序序号 }
  ],
  "newCategories": [
    { "id": "新分类id", "name": "分类名称", "icon": "Lucide图标名" }
  ]
}

可用的 Lucide 图标名举例：Star, Code, Palette, BookOpen, Gamepad2, Bot, Globe, Music, Video, ShoppingCart, Briefcase, GraduationCap, Heart, Camera, Cpu, Database, Shield, Zap, Cloud, Terminal, Smartphone, Mail, Map, Bookmark, FileText, Image, Layers, Users, Headphones, Tv, Wallet, Coffee, Plane, Building, Wrench, Lightbulb, Gift, Flag

注意：
- 只返回纯 JSON，不要任何额外解释
- 每个链接必须出现且只出现一次
- id 为 "common" 的分类不要删除，是保留分类
- 新分类的 id 用小写英文，简短有意义（如 "music", "video", "finance"）
- order 从 0 开始递增，同分类内连续编号`;

    const linksData = body.links.map((l: any) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      description: l.description || '',
      categoryId: l.categoryId,
    }));

    const catsData = body.categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
    }));

    const userPrompt = `现有分类：
${JSON.stringify(catsData, null, 2)}

书签列表：
${JSON.stringify(linksData, null, 2)}

请整理这些书签，将它们归入合适的分类并排序。`;

    // Call AI API from server side (no CORS / mixed content issues)
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return json({ error: `AI API 请求失败 (${aiResponse.status}): ${errorText}` }, 502);
    }

    const aiData = await aiResponse.json() as any;
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return json({ error: 'AI 返回内容为空' }, 502);
    }

    // Parse AI response
    let jsonStr = content.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return json({ error: 'AI 返回的 JSON 格式无效，请重试' }, 502);
    }

    return json(parsed);
  } catch (err: any) {
    return json({ error: `AI 整理失败: ${err.message || '未知错误'}` }, 500);
  }
};
