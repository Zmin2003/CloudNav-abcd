
interface Env {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD?: string;
}

type AppDataEnvelope = {
  version: number;
  updatedAt: number;
  links: any[];
  categories: any[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
  'Access-Control-Max-Age': '86400',
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

/** 清理字符串输入 */
function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 10000);
}

/** 验证 URL 格式 */
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length > 2048) return false;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 从 KV 中读取 app_data，兼容旧格式（无 version 字段）
 */
const getCurrentAppData = async (env: Env): Promise<AppDataEnvelope> => {
  const raw = await env.CLOUDNAV_KV.get('app_data');
  if (!raw) {
    return { version: 1, updatedAt: Date.now(), links: [], categories: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'version' in parsed) {
      return {
        version: Number(parsed.version) || 1,
        updatedAt: Number(parsed.updatedAt) || Date.now(),
        links: Array.isArray(parsed.links) ? parsed.links : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      };
    }
    // 旧格式：直接 { links, categories }
    return {
      version: 1,
      updatedAt: Date.now(),
      links: Array.isArray(parsed.links) ? parsed.links : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch {
    return { version: 1, updatedAt: Date.now(), links: [], categories: [] };
  }
};

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  // 1. Auth Check - 使用时序安全比较
  const providedPassword = request.headers.get('x-auth-password') || '';
  const serverPassword = env.PASSWORD || '';

  if (!serverPassword || !timingSafeEqual(providedPassword, serverPassword)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    // 检查请求体大小
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) { // 1MB limit
      return json({ error: 'Request body too large' }, 413);
    }

    const newLinkData = await request.json() as any;

    // Validate input - 严格验证
    if (!newLinkData || typeof newLinkData !== 'object') {
      return json({ error: 'Invalid request body' }, 400);
    }

    if (!newLinkData.title || typeof newLinkData.title !== 'string') {
      return json({ error: 'Missing or invalid title' }, 400);
    }

    if (!newLinkData.url || typeof newLinkData.url !== 'string') {
      return json({ error: 'Missing or invalid url' }, 400);
    }

    // URL 格式验证
    if (!isValidUrl(newLinkData.url)) {
      return json({ error: 'Invalid URL format' }, 400);
    }

    // 长度限制
    if (newLinkData.title.length > 500) {
      return json({ error: 'Title too long (max 500 characters)' }, 400);
    }

    if (newLinkData.url.length > 2048) {
      return json({ error: 'URL too long (max 2048 characters)' }, 400);
    }

    // 2. Fetch current data from KV (使用 envelope 格式)
    const currentData = await getCurrentAppData(env);

    // 限制总链接数量
    if (currentData.links.length >= 10000) {
      return json({ error: 'Maximum link count reached (10000)' }, 400);
    }

    // 3. Determine Category
    let targetCatId = '';
    let targetCatName = '';

    // 3a. Check for explicit categoryId from request
    if (newLinkData.categoryId && typeof newLinkData.categoryId === 'string') {
      const explicitCat = currentData.categories.find((c: any) => c.id === newLinkData.categoryId);
      if (explicitCat) {
        targetCatId = explicitCat.id;
        targetCatName = explicitCat.name;
      }
    }

    // 3b. Fallback: Auto-detect if no explicit category or explicit one not found
    if (!targetCatId) {
      if (currentData.categories && currentData.categories.length > 0) {
        const keywords = ['收集', '未分类', 'inbox', 'temp', 'later'];
        const match = currentData.categories.find((c: any) =>
          keywords.some(k => c.name.toLowerCase().includes(k))
        );

        if (match) {
          targetCatId = match.id;
          targetCatName = match.name;
        } else {
          const common = currentData.categories.find((c: any) => c.id === 'common');
          if (common) {
            targetCatId = 'common';
            targetCatName = common.name;
          } else {
            targetCatId = currentData.categories[0].id;
            targetCatName = currentData.categories[0].name;
          }
        }
      } else {
        targetCatId = 'common';
        targetCatName = '默认';
      }
    }

    // 4. Create new link object - 清理输入
    const newLink = {
      id: Date.now().toString(),
      title: sanitizeString(newLinkData.title).slice(0, 500),
      url: newLinkData.url.slice(0, 2048),
      description: typeof newLinkData.description === 'string' ? sanitizeString(newLinkData.description).slice(0, 1000) : '',
      categoryId: targetCatId,
      createdAt: Date.now(),
      pinned: false,
      icon: undefined
    };

    // 5. Append & save with envelope format (保持与 storage.ts 一致的数据格式)
    const next: AppDataEnvelope = {
      version: currentData.version + 1,
      updatedAt: Date.now(),
      links: [newLink, ...currentData.links],
      categories: currentData.categories,
    };

    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(next));

    return json({
      success: true,
      link: newLink,
      categoryName: targetCatName,
      version: next.version,
    });

  } catch (err: any) {
    return json({ error: 'Failed to process request' }, 500);
  }
};
