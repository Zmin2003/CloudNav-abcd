interface Env {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD?: string;
}

type PasswordExpiryUnit = 'day' | 'week' | 'month' | 'year' | 'permanent';
type PasswordExpiry = { value: number; unit: PasswordExpiryUnit };
type WebsiteConfig = { passwordExpiry?: PasswordExpiry };

type AppDataEnvelope = {
  version: number;
  updatedAt: number;
  links: any[];
  categories: any[];
};

// --- Security Helpers ---

/** 时间安全的字符串比较，防止时序攻击 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 即使长度不同也要做完比较，防止基于长度的时序泄露
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

/** 请求体大小限制 (bytes) */
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB

/** 检查请求体大小 */
async function checkBodySize(request: Request): Promise<string | null> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return 'Request body too large';
  }
  return null;
}

/** 清理字符串输入，防 XSS */
function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 10000); // 单字段最大长度
}

/** 验证 URL 格式 */
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** 清理链接数据 */
function sanitizeLink(link: any): any {
  if (!link || typeof link !== 'object') return null;
  return {
    id: sanitizeString(link.id).slice(0, 100),
    title: sanitizeString(link.title).slice(0, 500),
    url: typeof link.url === 'string' ? link.url.slice(0, 2048) : '',
    icon: typeof link.icon === 'string' ? link.icon.slice(0, 2048) : undefined,
    description: typeof link.description === 'string' ? sanitizeString(link.description).slice(0, 1000) : '',
    categoryId: sanitizeString(link.categoryId).slice(0, 100),
    createdAt: typeof link.createdAt === 'number' ? link.createdAt : Date.now(),
    order: typeof link.order === 'number' ? link.order : undefined,
    pinned: typeof link.pinned === 'boolean' ? link.pinned : false,
    pinnedOrder: typeof link.pinnedOrder === 'number' ? link.pinnedOrder : undefined,
  };
}

/** 清理分类数据 */
function sanitizeCategory(cat: any): any {
  if (!cat || typeof cat !== 'object') return null;
  return {
    id: sanitizeString(cat.id).slice(0, 100),
    name: sanitizeString(cat.name).slice(0, 200),
    icon: sanitizeString(cat.icon).slice(0, 200),
    password: typeof cat.password === 'string' ? cat.password.slice(0, 200) : undefined,
  };
}

// --- Core Helpers ---

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const safeJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const needAuth = (env: Env) => !!(env.PASSWORD && env.PASSWORD.trim());

const authorized = (env: Env, req: Request) => {
  if (!needAuth(env)) return true;
  const providedPassword = req.headers.get('x-auth-password') || '';
  return timingSafeEqual(providedPassword, env.PASSWORD!);
};

const getExpiryMs = (value: number, unit: PasswordExpiryUnit) => {
  switch (unit) {
    case 'day': return value * 24 * 60 * 60 * 1000;
    case 'week': return value * 7 * 24 * 60 * 60 * 1000;
    case 'month': return value * 30 * 24 * 60 * 60 * 1000;
    case 'year': return value * 365 * 24 * 60 * 60 * 1000;
    case 'permanent': return 0;
    default: return 0;
  }
};

const checkPasswordExpiry = async (env: Env) => {
  const websiteConfigStr = await env.CLOUDNAV_KV.get('website_config');
  const websiteConfig = safeJson<WebsiteConfig>(websiteConfigStr, {
    passwordExpiry: { value: 1, unit: 'week' }
  });

  const passwordExpiry = websiteConfig.passwordExpiry || { value: 1, unit: 'week' };
  if (passwordExpiry.unit === 'permanent') return { expired: false };

  const lastAuthTime = await env.CLOUDNAV_KV.get('last_auth_time');
  if (!lastAuthTime) return { expired: false };

  const lastTime = Number(lastAuthTime);
  if (!Number.isFinite(lastTime) || lastTime <= 0) return { expired: false };

  const expiryMs = getExpiryMs(Math.max(passwordExpiry.value || 1, 1), passwordExpiry.unit);
  return { expired: expiryMs > 0 && Date.now() - lastTime > expiryMs };
};

const getCurrentAppData = async (env: Env): Promise<AppDataEnvelope> => {
  const raw = await env.CLOUDNAV_KV.get('app_data');
  const parsed = safeJson<any>(raw, null);

  // 兼容旧格式（直接 { links, categories }）
  if (parsed && typeof parsed === 'object' && !('version' in parsed)) {
    return {
      version: 1,
      updatedAt: Date.now(),
      links: Array.isArray(parsed.links) ? parsed.links : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  }

  if (parsed && typeof parsed === 'object') {
    return {
      version: Number(parsed.version) || 1,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
      links: Array.isArray(parsed.links) ? parsed.links : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  }

  return {
    version: 1,
    updatedAt: Date.now(),
    links: [],
    categories: [],
  };
};

// --- Rate Limiting (simple in-memory, per-worker) ---
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.lastAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  record.count++;
  record.lastAttempt = now;
  return true;
}

function getClientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
}

// --- Handlers ---

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    const checkAuth = url.searchParams.get('checkAuth');
    const getConfig = url.searchParams.get('getConfig');

    if (checkAuth === 'true') {
      const requiresAuth = needAuth(env);
      if (!requiresAuth) {
        return json({ hasPassword: false, requiresAuth: false, expired: false });
      }

      const providedPassword = request.headers.get('x-auth-password');
      if (providedPassword && timingSafeEqual(providedPassword, env.PASSWORD!)) {
        const expiry = await checkPasswordExpiry(env);
        return json({ hasPassword: true, requiresAuth: true, expired: expiry.expired });
      }

      return json({ hasPassword: true, requiresAuth: true, expired: false });
    }

    // AI 配置需要鉴权（包含 API Key 等敏感信息）
    if (getConfig === 'ai') {
      if (needAuth(env) && !authorized(env, request)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const aiConfig = await env.CLOUDNAV_KV.get('ai_config');
      return new Response(aiConfig || '{}', {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 搜索配置（公开，不含敏感数据）
    if (getConfig === 'search') {
      const searchConfig = await env.CLOUDNAV_KV.get('search_config');
      return new Response(searchConfig || '{}', {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (getConfig === 'website') {
      const websiteConfig = await env.CLOUDNAV_KV.get('website_config');
      return new Response(websiteConfig || JSON.stringify({ passwordExpiry: { value: 1, unit: 'week' } }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (getConfig === 'site') {
      const siteConfig = await env.CLOUDNAV_KV.get('site_config');
      return new Response(siteConfig || '{}', {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (getConfig === 'favicon') {
      const domain = url.searchParams.get('domain');
      if (!domain) {
        return json({ error: 'Domain parameter is required' }, 400);
      }

      // 验证 domain 格式，防止 KV key 注入
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return json({ error: 'Invalid domain format' }, 400);
      }

      const cachedIcon = await env.CLOUDNAV_KV.get(`favicon:${domain}`);
      if (cachedIcon) {
        return json({ icon: cachedIcon, cached: true });
      }
      return json({ icon: null, cached: false });
    }

    // app_data 读取鉴权
    if (!authorized(env, request)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (needAuth(env)) {
      const expiry = await checkPasswordExpiry(env);
      if (expiry.expired) {
        return json({ error: '密码已过期，请重新输入' }, 401);
      }
      await env.CLOUDNAV_KV.put('last_auth_time', Date.now().toString());
    }

    const data = await getCurrentAppData(env);
    return json(data);
  } catch (err) {
    return json({ error: 'Failed to fetch data' }, 500);
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // 检查请求体大小
    const sizeError = await checkBodySize(request);
    if (sizeError) {
      return json({ error: sizeError }, 413);
    }

    const body = await request.json();

    if (body.authOnly) {
      if (!needAuth(env)) {
        return json({ success: true, noPasswordRequired: true });
      }

      // 登录限流
      const clientIp = getClientIp(request);
      if (!checkRateLimit(clientIp)) {
        return json({ error: '登录尝试过于频繁，请15分钟后重试' }, 429);
      }

      if (!authorized(env, request)) {
        return json({ error: 'Unauthorized' }, 401);
      }

      await env.CLOUDNAV_KV.put('last_auth_time', Date.now().toString());
      return json({ success: true });
    }

    // 配置写入
    if (body.saveConfig === 'search') {
      if (needAuth(env) && !authorized(env, request)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      await env.CLOUDNAV_KV.put('search_config', JSON.stringify(body.config || {}));
      return json({ success: true });
    }

    if (body.saveConfig === 'site') {
      if (needAuth(env) && !authorized(env, request)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      // 清理站点配置中的字段
      const siteConfig = body.config || {};
      const sanitizedSiteConfig: Record<string, any> = {};
      if (typeof siteConfig.websiteTitle === 'string') {
        sanitizedSiteConfig.websiteTitle = sanitizeString(siteConfig.websiteTitle).slice(0, 200);
      }
      if (typeof siteConfig.navigationName === 'string') {
        sanitizedSiteConfig.navigationName = sanitizeString(siteConfig.navigationName).slice(0, 200);
      }
      if (typeof siteConfig.faviconUrl === 'string') {
        if (isValidUrl(siteConfig.faviconUrl)) {
          sanitizedSiteConfig.faviconUrl = siteConfig.faviconUrl.slice(0, 2048);
        }
      }
      if (typeof siteConfig.sakuraEnabled === 'boolean') {
        sanitizedSiteConfig.sakuraEnabled = siteConfig.sakuraEnabled;
      }
      await env.CLOUDNAV_KV.put('site_config', JSON.stringify(sanitizedSiteConfig));
      return json({ success: true });
    }

    if (body.saveConfig === 'favicon') {
      const { domain, icon } = body;
      if (!domain || !icon) {
        return json({ error: 'Domain and icon are required' }, 400);
      }
      // 验证 domain 格式
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}[a-zA-Z0-9]$/;
      if (typeof domain !== 'string' || !domainRegex.test(domain)) {
        return json({ error: 'Invalid domain format' }, 400);
      }
      if (typeof icon !== 'string' || icon.length > 2048) {
        return json({ error: 'Invalid icon URL' }, 400);
      }
      await env.CLOUDNAV_KV.put(`favicon:${domain}`, icon, { expirationTtl: 30 * 24 * 60 * 60 });
      return json({ success: true });
    }

    // 以下写入必须鉴权
    if (needAuth(env) && !authorized(env, request)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (needAuth(env)) {
      const expiry = await checkPasswordExpiry(env);
      if (expiry.expired) {
        return json({ error: '密码已过期，请重新输入' }, 401);
      }
      await env.CLOUDNAV_KV.put('last_auth_time', Date.now().toString());
    }

    if (body.saveConfig === 'ai') {
      // 清理 AI 配置
      const aiConfig = body.config || {};
      const sanitizedAiConfig = {
        apiUrl: typeof aiConfig.apiUrl === 'string' ? aiConfig.apiUrl.slice(0, 2048) : '',
        apiKey: typeof aiConfig.apiKey === 'string' ? aiConfig.apiKey.slice(0, 500) : '',
        model: typeof aiConfig.model === 'string' ? sanitizeString(aiConfig.model).slice(0, 200) : '',
      };
      await env.CLOUDNAV_KV.put('ai_config', JSON.stringify(sanitizedAiConfig));
      return json({ success: true });
    }

    if (body.saveConfig === 'website') {
      await env.CLOUDNAV_KV.put('website_config', JSON.stringify(body.config || {}));
      return json({ success: true });
    }

    // app_data 并发冲突保护
    const current = await getCurrentAppData(env);
    const baseVersion = Number(body.baseVersion ?? current.version);

    if (baseVersion !== current.version) {
      return json({ error: 'Conflict', code: 409, currentVersion: current.version }, 409);
    }

    // 兼容两种写入格式：{links,categories} 或旧的直接对象
    const rawLinks = Array.isArray(body.links) ? body.links : Array.isArray(body?.data?.links) ? body.data.links : [];
    const rawCategories = Array.isArray(body.categories) ? body.categories : Array.isArray(body?.data?.categories) ? body.data.categories : [];

    // 限制总数量
    if (rawLinks.length > 10000) {
      return json({ error: 'Too many links (max 10000)' }, 400);
    }
    if (rawCategories.length > 500) {
      return json({ error: 'Too many categories (max 500)' }, 400);
    }

    // 清理所有链接和分类数据
    const nextLinks = rawLinks.map(sanitizeLink).filter(Boolean);
    const nextCategories = rawCategories.map(sanitizeCategory).filter(Boolean);

    const next: AppDataEnvelope = {
      version: current.version + 1,
      updatedAt: Date.now(),
      links: nextLinks,
      categories: nextCategories,
    };

    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(next));
    return json({ success: true, version: next.version, updatedAt: next.updatedAt });
  } catch (err) {
    return json({ error: 'Failed to save data' }, 500);
  }
};
