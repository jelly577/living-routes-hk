// Supabase Edge Function: turns one memoir photo into a short motion clip with
// an image-to-video model hosted on Replicate.
//
// Deploy:  supabase functions deploy animate
// Secrets: supabase secrets set REPLICATE_API_TOKEN=...
//          optional ANIMATE_MODEL (default wan-video/wan-2.2-i2v-fast)
//          optional ANIMATE_EXTRA_INPUT='{"resolution":"480p"}' (model-specific inputs)
//
// Generation takes from ~30 s to a few minutes, so it is a job:
//   { action: 'start', image: <jpeg data URL>, prompt }  → { jobId }
//   { action: 'status', jobId }                          → { status, error? }
//   { action: 'download', jobId }                        → video/mp4 bytes
// Downloading through this function keeps the clip CORS-clean for the canvas
// and means the browser never needs a Replicate URL or token.

const TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
const MODEL = Deno.env.get('ANIMATE_MODEL') || 'wan-video/wan-2.2-i2v-fast';
const EXTRA_INPUT = (() => {
  try { return JSON.parse(Deno.env.get('ANIMATE_EXTRA_INPUT') || '{}'); } catch { return {}; }
})();
const API = 'https://api.replicate.com/v1';
const MAX_IMAGE_CHARS = 1_400_000; // ~1 MB JPEG as base64
const INLINE_LIMIT = 200_000; // larger images are uploaded to Replicate Files first

const SAFETY_SUFFIX = ' Keep every face and identity exactly as in the photo. Realistic, natural motion. No new people, animals or objects. No text.';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json' },
});
const replicate = (path: string, init: RequestInit = {}) => fetch(`${API}${path}`, {
  ...init,
  headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) },
});

async function imageInput(dataUrl: string) {
  if (dataUrl.length <= INLINE_LIMIT) return dataUrl;
  // Replicate recommends file uploads over large data URLs.
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append('content', new Blob([bytes], { type: 'image/jpeg' }), 'memory.jpg');
  const response = await replicate('/files', { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Image upload failed (${response.status}).`);
  return (await response.json()).urls.get;
}

function outputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return outputUrl(output[0]);
  if (output && typeof output === 'object' && 'url' in output) return String((output as { url: string }).url);
  return null;
}

async function start(body: any) {
  const image = typeof body.image === 'string' ? body.image : '';
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_IMAGE_CHARS) return json({ error: 'A JPEG data URL under 1 MB is required.' }, 400);
  const prompt = String(body.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!prompt) return json({ error: 'A motion prompt is required.' }, 400);

  const [owner, name] = MODEL.split('/');
  const response = await replicate(`/models/${owner}/${name}/predictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { ...EXTRA_INPUT, image: await imageInput(image), prompt: prompt + SAFETY_SUFFIX } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Replicate start failed', response.status, JSON.stringify(result).slice(0, 400));
    return json({ error: `Video model request failed (${response.status}).` }, 502);
  }
  return json({ jobId: result.id, model: MODEL });
}

async function prediction(jobId: string) {
  if (!/^[a-z0-9]{10,40}$/i.test(jobId)) throw new Error('Unknown job.');
  const response = await replicate(`/predictions/${jobId}`);
  if (!response.ok) throw new Error(`Status check failed (${response.status}).`);
  return response.json();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!TOKEN) return json({ error: 'Photo animation is not configured (missing REPLICATE_API_TOKEN).' }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }

  try {
    if (body.action === 'start') return await start(body);
    if (body.action === 'status') {
      const result = await prediction(String(body.jobId));
      // starting | processing | succeeded | failed | canceled
      return json({ status: result.status, error: result.error ? String(result.error).slice(0, 200) : undefined });
    }
    if (body.action === 'download') {
      const result = await prediction(String(body.jobId));
      const url = result.status === 'succeeded' ? outputUrl(result.output) : null;
      if (!url) return json({ error: 'The clip is not ready.' }, 409);
      const video = await fetch(url);
      if (!video.ok || !video.body) return json({ error: 'The clip could not be fetched.' }, 502);
      // octet-stream: supabase-js `functions.invoke` returns this as a Blob (video/* would be read as text).
      return new Response(video.body, { headers: { ...CORS, 'Content-Type': 'application/octet-stream' } });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
});
