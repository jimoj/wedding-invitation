const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // GET /list — return bucket contents sorted newest-first
    if (request.method === 'GET' && url.pathname === '/list') {
      try {
        const listed = await env.BODA_BUCKET.list();
        const files = listed.objects
          .map(obj => ({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded.toISOString(),
          }))
          .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));

        return new Response(JSON.stringify({ files }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    // POST / — upload file to R2
    if (request.method === 'POST') {
      const filename = url.searchParams.get('filename') || 'upload.bin';
      const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
      const ext = filename.split('.').pop() || 'bin';
      const key = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

      try {
        await env.BODA_BUCKET.put(key, request.body, {
          httpMetadata: { contentType },
        });
        return new Response(JSON.stringify({ key }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  },
};
