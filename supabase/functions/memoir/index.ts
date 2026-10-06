// Supabase Edge Function: writes travel-memoir captions from the user's own photos.
//
// Deploy:  supabase functions deploy memoir
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...  (optional: MEMOIR_MODEL)
//
// The browser only sends posts the user explicitly allowed for AI, downscaled
// JPEGs and place *names* (never GPS). Requests must carry a Supabase session
// JWT (the app signs in anonymously), which the platform verifies by default.

const MODEL = Deno.env.get('MEMOIR_MODEL') || 'claude-sonnet-5-5';
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MAX_MEMORIES = 20;
const MAX_IMAGE_CHARS = 700_000; // base64 of a ~500 KB JPEG

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json' },
});

const LANGUAGE_NOTE: Record<string, string> = {
  en: 'English',
  'zh-HK': 'Traditional Chinese written in a natural Hong Kong Cantonese voice (書面粵語可少量使用，以自然易讀為主)',
  'zh-CN': 'Simplified Chinese (Mandarin)',
};

type Memory = { postId: string; day?: string; text?: string; image?: string | null };
type Stop = { stopId: string; place?: string; day?: string; memories: Memory[] };

function validate(body: any): { language: string; stops: Stop[] } {
  if (!body || !Array.isArray(body.stops) || body.stops.length === 0) throw new Error('No stops provided.');
  const language = LANGUAGE_NOTE[body.language] ? body.language : 'en';
  let count = 0;
  const stops: Stop[] = body.stops.slice(0, MAX_MEMORIES).map((stop: any) => ({
    stopId: String(stop.stopId).slice(0, 40),
    place: String(stop.place || '').slice(0, 80),
    day: String(stop.day || '').slice(0, 10),
    memories: (Array.isArray(stop.memories) ? stop.memories : []).map((memory: any) => {
      count += 1;
      const image = typeof memory.image === 'string' && memory.image.length < MAX_IMAGE_CHARS
        ? memory.image.replace(/^data:image\/jpeg;base64,/, '') : null;
      return {
        postId: String(memory.postId).slice(0, 80),
        day: String(memory.day || '').slice(0, 10),
        text: String(memory.text || '').slice(0, 600),
        image: image && /^[A-Za-z0-9+/=]+$/.test(image) ? image : null,
      };
    }),
  }));
  if (count > MAX_MEMORIES) throw new Error(`At most ${MAX_MEMORIES} memories per memoir.`);
  return { language, stops };
}

const MEMOIR_TOOL = {
  name: 'write_memoir',
  description: 'Return the memoir script for the travel video.',
  input_schema: {
    type: 'object',
    required: ['title', 'closing', 'stops'],
    properties: {
      title: { type: 'string', description: 'Video title, at most ~8 words / 14 Chinese characters.' },
      closing: { type: 'string', description: 'One closing line for the final frame.' },
      stops: {
        type: 'array',
        items: {
          type: 'object',
          required: ['stopId', 'title', 'memories'],
          properties: {
            stopId: { type: 'string' },
            title: { type: 'string', description: 'Short stop heading; may simply be the place name.' },
            memories: {
              type: 'array',
              items: {
                type: 'object',
                required: ['postId', 'caption', 'motion'],
                properties: {
                  postId: { type: 'string' },
                  caption: { type: 'string', description: 'First-person memory, 1–2 sentences, readable in ~4 seconds.' },
                  motion: { type: 'string', description: 'English prompt for an image-to-video model: the natural few-second motion that continues this exact photo.' },
                },
              },
            },
          },
        },
      },
    },
  },
};

function buildContent(language: string, stops: Stop[]) {
  const content: any[] = [{
    type: 'text',
    text: [
      `Write a short first-person travel memoir for a phone video, in ${LANGUAGE_NOTE[language]}.`,
      'The video moves across a map of Hong Kong, stopping at each place in time order and showing each photo for about four seconds.',
      'For every memory write one caption (1–2 short sentences; English ≤ 28 words, Chinese ≤ 45 characters).',
      'Ground each caption in what is actually visible in that photo and in the traveller\'s own note. Keep their meaning and feelings; you may make the wording warmer, but do not invent people, names, events, food or facts that are not shown or written.',
      'Do not identify or describe any real person by name or appearance. If a photo is unclear, rely on the note.',
      'Let the captions read as one continuous journey (gentle links between stops are welcome).',
      'For every memory with a photo also write `motion`: one English sentence (≤ 40 words) for an image-to-video model describing the natural motion that would continue this exact photo for about 5 seconds — what the people, animals, food, water, light or camera do next (e.g. "the person lifts the chopsticks and takes a bite, steam curling from the bowl, slight handheld camera"; "the kitten paws at the person\'s hand and they laugh, gentle push-in").',
      'Motion must fit what is visible and the traveller\'s note: no new people, animals or objects, no scene change, keep every face and identity exactly as in the photo, no text overlays. Use "the person" rather than guessing who anyone is.',
      'Return the result only by calling write_memoir, using every stopId and postId exactly as given.',
    ].join('\n'),
  }];
  for (const stop of stops) {
    content.push({ type: 'text', text: `\n=== stopId: ${stop.stopId} · place: ${stop.place || 'Hong Kong'} · date: ${stop.day || 'unknown'} ===` });
    for (const memory of stop.memories) {
      content.push({ type: 'text', text: `postId: ${memory.postId} · date: ${memory.day || 'unknown'}\nTraveller's note: ${memory.text || '(no note)'}` });
      if (memory.image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: memory.image } });
    }
  }
  return content;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!API_KEY) return json({ error: 'Memoir AI is not configured (missing ANTHROPIC_API_KEY).' }, 503);

  let input;
  try { input = validate(await request.json()); }
  catch (error) { return json({ error: (error as Error).message }, 400); }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      tools: [MEMOIR_TOOL],
      tool_choice: { type: 'tool', name: MEMOIR_TOOL.name },
      messages: [{ role: 'user', content: buildContent(input.language, input.stops) }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Model request failed', response.status, detail.slice(0, 500));
    return json({ error: `Model request failed (${response.status}).` }, 502);
  }
  const result = await response.json();
  const call = (result.content || []).find((block: any) => block.type === 'tool_use' && block.name === MEMOIR_TOOL.name);
  if (!call) return json({ error: 'Model returned no memoir.' }, 502);
  return json({ ...call.input, model: MODEL });
});
