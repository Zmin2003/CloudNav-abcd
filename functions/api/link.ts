
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
  'Access-Control-Max-Age': '86400',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

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

  // 1. Auth Check
  const providedPassword = request.headers.get('x-auth-password');
  const serverPassword = env.PASSWORD;

  if (!serverPassword || providedPassword !== serverPassword) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const newLinkData = await request.json() as any;

    // Validate input
    if (!newLinkData.title || !newLinkData.url) {
      return json({ error: 'Missing title or url' }, 400);
    }

    // 2. Fetch current data from KV (使用 envelope 格式)
    const currentData = await getCurrentAppData(env);

    // 3. Determine Category
    let targetCatId = '';
    let targetCatName = '';

    // 3a. Check for explicit categoryId from request
    if (newLinkData.categoryId) {
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

    // 4. Create new link object
    const newLink = {
      id: Date.now().toString(),
      title: newLinkData.title,
      url: newLinkData.url,
      description: newLinkData.description || '',
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
    return json({ error: err.message }, 500);
  }
};
