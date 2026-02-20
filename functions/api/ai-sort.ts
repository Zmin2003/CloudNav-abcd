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

/** 时间安全的字符串比较 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let result = a.length ^ b.length;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return result === 0;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** 验证 URL 格式 */
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // Auth check - 时序安全比较
    if (env.PASSWORD && env.PASSWORD.trim()) {
      const providedPassword = request.headers.get('x-auth-password') || '';
      if (!timingSafeEqual(providedPassword, env.PASSWORD)) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    // 请求体大小检查
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) { // 2MB
      return json({ error: 'Request body too large' }, 413);
    }

    const body = await request.json() as {
      links: any[];
      categories: any[];
    };

    if (!Array.isArray(body.links) || !Array.isArray(body.categories)) {
      return json({ error: 'Invalid request: links and categories are required' }, 400);
    }

    // 数量限制
    if (body.links.length > 5000) {
      return json({ error: '书签数量过多，最多支持 5000 个书签的 AI 整理' }, 400);
    }

    if (body.categories.length > 200) {
      return json({ error: '分类数量过多' }, 400);
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

    // 验证 AI API URL 格式
    let apiUrl = aiConfig.apiUrl.trim();
    if (!isValidHttpUrl(apiUrl.endsWith('/chat/completions') ? apiUrl : apiUrl + '/v1/chat/completions')) {
      // 尝试构建完整 URL 后验证
      if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
        return json({ error: 'AI API 地址格式无效，必须以 http:// 或 https:// 开头' }, 400);
      }
    }

    // Build API URL
    if (!apiUrl.endsWith('/chat/completions')) {
      if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
      if (!apiUrl.endsWith('/v1')) apiUrl += '/v1';
      apiUrl += '/chat/completions';
    }

    // 最终 URL 验证
    if (!isValidHttpUrl(apiUrl)) {
      return json({ error: 'AI API 地址格式无效' }, 400);
    }

    // Build prompts
    const systemPrompt = `你是一个书签整理助手。用户会给你一组书签链接（包含 title、url、description、icon、categoryId）和现有分类列表。

你的任务：
1. 分析每个书签的 title、url、description，判断它最适合归入哪个分类
2. categoryId 为 "common"（常用推荐）的书签不要移动，保持原样
3. 如果现有分类不足以覆盖某些书签，你可以创建新分类
4. 对同一分类下的书签按相关性进行排序
5. **整理书签名称**：如果 title 不够简洁或不够清晰，优化为更简短、直观的名称（例如 "GitHub: Let's build from here · GitHub" → "GitHub"，"Google 翻译" 保持不变）
6. **补充网站图标**：如果书签的 icon 字段为空或缺失，根据 url 推断合适的 favicon 地址，格式为 https://域名/favicon.ico 或使用 Google favicon 服务 https://www.google.com/s2/favicons?domain=域名&sz=64。如果 icon 已有值则保持不变。

返回格式为 JSON：
{
  "links": [
    { "id": "原始id", "categoryId": "目标分类id", "order": 排序序号, "title": "整理后的名称", "icon": "图标URL" }
  ],
  "newCategories": [
    { "id": "新分类id", "name": "分类名称", "icon": "Lucide图标名" }
  ]
}

可用的 Lucide 图标名举例（仅用于分类图标）：Star, Code, Palette, BookOpen, Gamepad2, Bot, Globe, Music, Video, ShoppingCart, Briefcase, GraduationCap, Heart, Camera, Cpu, Database, Shield, Zap, Cloud, Terminal, Smartphone, Mail, Map, Bookmark, FileText, Image, Layers, Users, Headphones, Tv, Wallet, Coffee, Plane, Building, Wrench, Lightbulb, Gift, Flag

注意：
- 只返回纯 JSON，不要任何额外解释
- 每个链接必须出现且只出现一次
- id 为 "common" 的分类不要删除，是保留分类
- 新分类的 id 用小写英文，简短有意义（如 "music", "video", "finance"）
- order 从 0 开始递增，同分类内连续编号
- links 中每项必须包含 title 和 icon 字段
- icon 是网站 favicon 的完整 URL（不是 Lucide 图标名）`;

    // 清理输入数据，只传必要字段给 AI
    const linksData = body.links.map((l: any) => ({
      id: typeof l.id === 'string' ? l.id.slice(0, 100) : '',
      title: typeof l.title === 'string' ? l.title.slice(0, 500) : '',
      url: typeof l.url === 'string' ? l.url.slice(0, 2048) : '',
      description: typeof l.description === 'string' ? l.description.slice(0, 500) : '',
      icon: typeof l.icon === 'string' ? l.icon.slice(0, 2048) : '',
      categoryId: typeof l.categoryId === 'string' ? l.categoryId.slice(0, 100) : '',
    }));

    const catsData = body.categories.map((c: any) => ({
      id: typeof c.id === 'string' ? c.id.slice(0, 100) : '',
      name: typeof c.name === 'string' ? c.name.slice(0, 200) : '',
      icon: typeof c.icon === 'string' ? c.icon.slice(0, 200) : '',
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
      // 不要把完整的错误信息暴露给前端，可能包含敏感信息
      return json({ error: `AI API 请求失败 (${aiResponse.status})` }, 502);
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

    // 验证 AI 返回的结构
    if (!parsed || !Array.isArray(parsed.links)) {
      return json({ error: 'AI 返回的数据结构无效' }, 502);
    }

    return json(parsed);
  } catch (err: any) {
    return json({ error: 'AI 整理失败，请重试' }, 500);
  }
};
