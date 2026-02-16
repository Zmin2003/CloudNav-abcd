
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

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost = async (context: { request: Request }) => {
  const { request } = context;

  try {
    const body = await request.json() as any;
    const { operation, config, payload } = body;

    if (!config || !config.url || !config.username || !config.password) {
      return json({ error: 'Missing configuration' }, 400);
    }

    // 1. URL 处理：确保目录以 / 结尾
    let baseUrl = config.url.trim();
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    // 文件名固定
    const filename = 'cloudnav_backup.json';
    const fileUrl = baseUrl + filename;

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
    } else {
      return json({ error: 'Invalid operation' }, 400);
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
    return json({ error: err.message }, 500);
  }
};
