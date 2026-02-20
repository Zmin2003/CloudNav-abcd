
interface Env {
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

/** SSRF 防护: 验证 URL 是否为安全的外部 URL */
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // 只允许 HTTPS（WebDAV 应该使用加密连接）
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 禁止内网地址
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')) {
      return false;
    }

    // 禁止私有 IP 范围
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      if (a === 10) return false;                    // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
      if (a === 192 && b === 168) return false;       // 192.168.0.0/16
      if (a === 169 && b === 254) return false;       // 169.254.0.0/16 (link-local)
      if (a === 0) return false;                      // 0.0.0.0/8
      if (a === 127) return false;                    // 127.0.0.0/8
    }

    // 禁止 Cloudflare Workers 内部地址
    if (hostname.endsWith('.workers.dev') || hostname.endsWith('.cloudflarestorage.com')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    // 鉴权: WebDAV 操作需要验证身份
    if (env.PASSWORD && env.PASSWORD.trim()) {
      const providedPassword = request.headers.get('x-auth-password') || '';
      if (!timingSafeEqual(providedPassword, env.PASSWORD)) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    // 请求体大小限制
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) { // 10MB for backup data
      return json({ error: 'Request body too large' }, 413);
    }

    const body = await request.json() as any;
    const { operation, config, payload } = body;

    // 验证操作类型
    const validOperations = ['check', 'upload', 'download'];
    if (!operation || !validOperations.includes(operation)) {
      return json({ error: 'Invalid operation' }, 400);
    }

    if (!config || !config.url || !config.username || !config.password) {
      return json({ error: 'Missing configuration' }, 400);
    }

    // 输入长度限制
    if (typeof config.url !== 'string' || config.url.length > 2048 ||
        typeof config.username !== 'string' || config.username.length > 200 ||
        typeof config.password !== 'string' || config.password.length > 200) {
      return json({ error: 'Invalid configuration values' }, 400);
    }

    // 1. URL 处理：确保目录以 / 结尾
    let baseUrl = config.url.trim();
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    // SSRF 防护: 验证 URL
    if (!isValidExternalUrl(baseUrl)) {
      return json({ error: 'Invalid WebDAV URL. Only HTTPS external URLs are allowed.' }, 400);
    }

    // 文件名固定
    const filename = 'cloudnav_backup.json';
    const fileUrl = baseUrl + filename;

    // 再次验证完整文件 URL
    if (!isValidExternalUrl(fileUrl)) {
      return json({ error: 'Invalid WebDAV file URL' }, 400);
    }

    // 2. 构建认证 Header
    const authHeader = `Basic ${btoa(`${config.username}:${config.password}`)}`;

    let fetchUrl = baseUrl;
    let method = 'PROPFIND';
    let headers: Record<string, string> = {
      'Authorization': authHeader,
      'User-Agent': 'ZminNav/1.0'
    };
    let requestBody: string | undefined = undefined;

    // 3. 根据操作类型构建请求
    if (operation === 'check') {
      fetchUrl = baseUrl;
      method = 'PROPFIND';
      headers['Depth'] = '0';
    } else if (operation === 'upload') {
      fetchUrl = fileUrl;
      method = 'PUT';
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(payload);
    } else if (operation === 'download') {
      fetchUrl = fileUrl;
      method = 'GET';
    }

    // 4. 发起服务器端请求 (无 CORS 限制)
    const response = await fetch(fetchUrl, {
      method,
      headers,
      body: requestBody
    });

    // 5. 处理响应
    if (operation === 'download') {
      if (!response.ok) {
        if (response.status === 404) {
          return json({ error: 'Backup file not found' }, 404);
        }
        return json({ error: `WebDAV Error: ${response.status}` }, response.status);
      }
      const data = await response.json();
      return json(data);
    }

    // 检查和上传操作：WebDAV 成功状态码通常为 200, 201, 204, 207
    const success = response.ok || response.status === 207;
    return json({ success, status: response.status });

  } catch (err: any) {
    return json({ error: 'WebDAV operation failed' }, 500);
  }
};
