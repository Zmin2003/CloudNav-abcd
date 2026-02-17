import { LinkItem, Category, AiSortConfig } from '../types';

interface AiSortResult {
  links: LinkItem[];
  categories: Category[];
  newCategoriesCreated: string[];
}

const SYSTEM_PROMPT = `你是一个书签整理助手。用户会给你一组书签链接（包含 title、url、description、categoryId）和现有分类列表。

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

function buildUserPrompt(links: LinkItem[], categories: Category[]): string {
  const linksData = links.map(l => ({
    id: l.id,
    title: l.title,
    url: l.url,
    description: l.description || '',
    categoryId: l.categoryId,
  }));

  const catsData = categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
  }));

  return `现有分类：
${JSON.stringify(catsData, null, 2)}

书签列表：
${JSON.stringify(linksData, null, 2)}

请整理这些书签，将它们归入合适的分类并排序。`;
}

export async function aiSortLinks(
  links: LinkItem[],
  categories: Category[],
  config: AiSortConfig,
): Promise<AiSortResult> {
  if (!config.apiUrl || !config.apiKey || !config.model) {
    throw new Error('请先在设置中配置 AI API 地址、Key 和模型');
  }

  const userPrompt = buildUserPrompt(links, categories);

  // Build the API URL - handle both /v1/chat/completions and base URL formats
  let apiUrl = config.apiUrl.trim();
  if (!apiUrl.endsWith('/chat/completions')) {
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
    if (!apiUrl.endsWith('/v1')) apiUrl += '/v1';
    apiUrl += '/chat/completions';
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI 返回内容为空');
  }

  // Parse the JSON response - handle markdown code blocks
  let jsonStr = content.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: { links: { id: string; categoryId: string; order: number }[]; newCategories?: { id: string; name: string; icon: string }[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('AI 返回的 JSON 格式无效，请重试');
  }

  // Validate & merge results
  const newCategoriesCreated: string[] = [];

  // Build new categories list
  let mergedCategories = [...categories];
  if (parsed.newCategories && Array.isArray(parsed.newCategories)) {
    for (const nc of parsed.newCategories) {
      if (!mergedCategories.some(c => c.id === nc.id)) {
        mergedCategories.push({ id: nc.id, name: nc.name, icon: nc.icon || 'Bookmark' });
        newCategoriesCreated.push(nc.name);
      }
    }
  }

  // Build updated links
  const validCatIds = new Set(mergedCategories.map(c => c.id));
  const updatedLinks = links.map(link => {
    const aiResult = parsed.links?.find(r => r.id === link.id);
    if (!aiResult) return link;

    // Don't move "common" category links
    if (link.categoryId === 'common') return link;

    const targetCatId = validCatIds.has(aiResult.categoryId) ? aiResult.categoryId : link.categoryId;
    return {
      ...link,
      categoryId: targetCatId,
      order: aiResult.order !== undefined ? aiResult.order : link.order,
    };
  });

  return {
    links: updatedLinks,
    categories: mergedCategories,
    newCategoriesCreated,
  };
}
