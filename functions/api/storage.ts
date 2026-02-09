interface Env {
  CLOUDNAV_KV: any;
  PASSWORD: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

const checkPasswordExpiry = async (env: Env) => {
  const websiteConfigStr = await env.CLOUDNAV_KV.get('website_config');
  const websiteConfig = websiteConfigStr
    ? JSON.parse(websiteConfigStr)
    : { passwordExpiry: { value: 1, unit: 'week' } };
  const passwordExpiry = websiteConfig.passwordExpiry || { value: 1, unit: 'week' };

  if (passwordExpiry.unit === 'permanent') return { expired: false };

  const lastAuthTime = await env.CLOUDNAV_KV.get('last_auth_time');
  if (!lastAuthTime) return { expired: false };

  const lastTime = parseInt(lastAuthTime);
  const now = Date.now();
  let expiryMs = 0;

  switch (passwordExpiry.unit) {
    case 'day':
      expiryMs = passwordExpiry.value * 24 * 60 * 60 * 1000;
      break;
    case 'week':
      expiryMs = passwordExpiry.value * 7 * 24 * 60 * 60 * 1000;
      break;
    case 'month':
      expiryMs = passwordExpiry.value * 30 * 24 * 60 * 60 * 1000;
      break;
    case 'year':
      expiryMs = passwordExpiry.value * 365 * 24 * 60 * 60 * 1000;
      break;
  }

  return { expired: expiryMs > 0 && now - lastTime > expiryMs };
};

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    const checkAuth = url.searchParams.get('checkAuth');
    const getConfig = url.searchParams.get('getConfig');

    if (checkAuth === 'true') {
      const serverPassword = env.PASSWORD;
      return new Response(JSON.stringify({
        hasPassword: !!serverPassword,
        requiresAuth: !!serverPassword
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
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
        return new Response(JSON.stringify({ error: 'Domain parameter is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const cachedIcon = await env.CLOUDNAV_KV.get(`favicon:${domain}`);
      if (cachedIcon) {
        return new Response(JSON.stringify({ icon: cachedIcon, cached: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ icon: null, cached: false }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 读取 app_data 时，如果服务端配置了密码，必须鉴权
    const serverPassword = env.PASSWORD;
    if (serverPassword) {
      const password = request.headers.get('x-auth-password');
      if (!password || password !== serverPassword) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const expiry = await checkPasswordExpiry(env);
      if (expiry.expired) {
        return new Response(JSON.stringify({ error: '密码已过期，请重新输入' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      await env.CLOUDNAV_KV.put('last_auth_time', Date.now().toString());
    }

    const data = await env.CLOUDNAV_KV.get('app_data');
    if (!data) {
      return new Response(JSON.stringify({ links: [], categories: [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(data, {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const providedPassword = request.headers.get('x-auth-password');
  const serverPassword = env.PASSWORD;

  try {
    const body = await request.json();

    if (body.authOnly) {
      // 未配置密码时视为不需要登录
      if (!serverPassword) {
        return new Response(JSON.stringify({ success: true, noPasswordRequired: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (providedPassword !== serverPassword) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      await env.CLOUDNAV_KV.put('last_auth_time', Date.now().toString());

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (body.saveConfig === 'search') {
      if (serverPassword && (!providedPassword || providedPassword !== serverPassword)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      await env.CLOUDNAV_KV.put('search_config', JSON.stringify(body.config));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (body.saveConfig === 'site') {
      if (serverPassword && (!providedPassword || providedPassword !== serverPassword)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      await env.CLOUDNAV_KV.put('site_config', JSON.stringify(body.config));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (body.saveConfig === 'favicon') {
      const { domain, icon } = body;
      if (!domain || !icon) {
        return new Response(JSON.stringify({ error: 'Domain and icon are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      await env.CLOUDNAV_KV.put(`favicon:${domain}`, icon, { expirationTtl: 30 * 24 * 60 * 60 });
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (serverPassword && (!providedPassword || providedPassword !== serverPassword)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (body.saveConfig === 'ai') {
      await env.CLOUDNAV_KV.put('ai_config', JSON.stringify(body.config));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (body.saveConfig === 'website') {
      await env.CLOUDNAV_KV.put('website_config', JSON.stringify(body.config));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(body));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to save data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
