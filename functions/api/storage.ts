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
  return providedPassword === env.PASSWORD;
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
      if (providedPassword && providedPassword === env.PASSWORD) {
        const expiry = await checkPasswordExpiry(env);
        return json({ hasPassword: true, requiresAuth: true, expired: expiry.expired });
      }

      return json({ hasPassword: true, requiresAuth: true, expired: false });
    }

    if (getConfig === 'ai') {
      const aiConfig = await env.CLOUDNAV_KV.get('ai_config');
      return new Response(aiConfig || '{}', {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

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
    const body = await request.json();

    if (body.authOnly) {
      if (!needAuth(env)) {
        return json({ success: true, noPasswordRequired: true });
      }

      if (!authorized(env, request)) {
        return json({ error: 'Unauthorized' }, 401);
      }

      await env.CLOUDNAV_KV.put('last_auth_time', Date.now().toString());
      return json({ success: true });
    }

    // 配置写入（search/site/favicon 不要求密码也可写，保持原行为）
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
      await env.CLOUDNAV_KV.put('site_config', JSON.stringify(body.config || {}));
      return json({ success: true });
    }

    if (body.saveConfig === 'favicon') {
      const { domain, icon } = body;
      if (!domain || !icon) {
        return json({ error: 'Domain and icon are required' }, 400);
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
      await env.CLOUDNAV_KV.put('ai_config', JSON.stringify(body.config || {}));
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
    const nextLinks = Array.isArray(body.links) ? body.links : Array.isArray(body?.data?.links) ? body.data.links : [];
    const nextCategories = Array.isArray(body.categories) ? body.categories : Array.isArray(body?.data?.categories) ? body.data.categories : [];

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
