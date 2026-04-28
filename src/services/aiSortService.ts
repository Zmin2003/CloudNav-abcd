import { LinkItem, Category, AiSortConfig } from '../types';

interface AiSortResult {
  links: LinkItem[];
  categories: Category[];
  newCategoriesCreated: string[];
}

/**
 * AI 智能排序 — 通过服务端代理 (/api/ai-sort) 调用 AI API，
 * 避免浏览器 CORS / 混合内容 / API Key 暴露问题。
 */
export async function aiSortLinks(
  links: LinkItem[],
  categories: Category[],
  _config: AiSortConfig,
  authToken?: string,
): Promise<AiSortResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['x-auth-password'] = authToken;

  const response = await fetch('/api/ai-sort', {
    method: 'POST',
    headers,
    body: JSON.stringify({ links, categories }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errorData.error || `请求失败 (${response.status})`);
  }

  const parsed = await response.json() as {
    links: { id: string; categoryId: string; order: number; title?: string; icon?: string }[];
    newCategories?: { id: string; name: string; icon: string }[];
  };

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
      title: aiResult.title && aiResult.title.trim() ? aiResult.title.trim() : link.title,
      icon: aiResult.icon && aiResult.icon.trim() ? aiResult.icon.trim() : link.icon,
    };
  });

  return {
    links: updatedLinks,
    categories: mergedCategories,
    newCategoriesCreated,
  };
}
