const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return new Response(JSON.stringify({ error: 'filename and contentType required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const ext = filename.split('.').pop() || 'bin';
    const key = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const url = await env.BODA_BUCKET.createPresignedUrl('PUT', key, {
      expiresIn: 900,
      httpMetadata: { contentType },
    });

    return new Response(JSON.stringify({ uploadUrl: url, key }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },
};
