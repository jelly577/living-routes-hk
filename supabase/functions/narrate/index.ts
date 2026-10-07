// Supabase Edge Function: writes the "Time Travel" narration for a heritage
// place — a short spoken script that bridges that place's past and present.
//
// Deploy:  supabase functions deploy narrate
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...  (optional: NARRATE_MODEL)
//
// The browser sends only place *names* and the text of posts the user can see
// (never GPS). Requests must carry a Supabase session JWT (the app signs in
// anonymously), which the platform verifies by default.

const MODEL = Deno.env.get('NARRATE_MODEL') || 'claude-sonnet-5-5';
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

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

type Note = { author?: string; text: string };

function validate(body: any): { place: string; language: string; era: 'old' | 'new'; current: Note[]; bridge: string } {
  const place = String(body?.place || '').slice(0, 80) || 'this place';
  const language = LANGUAGE_NOTE[body?.language] ? body.language : 'en';
  const era = body?.era === 'old' ? 'old' : 'new';
  const current: Note[] = (Array.isArray(body?.current) ? body.current : [])
    .slice(0, 12)
    .map((m: any) => ({
      author: String(m?.author || '').slice(0, 40),
      text: String(m?.text || '').slice(0, 400),
    }))
    .filter((m) => m.text);
  const bridge = String(body?.bridge || '').slice(0, 300);
  return { place, language, era, current, bridge };
}

const NARRATION_TOOL = {
  name: 'write_narration',
  description: 'Return the spoken time-travel narration for the heritage place.',
  input_schema: {
    type: 'object',
    required: ['title', 'text'],
    properties: {
      title: { type: 'string', description: 'Short heading, at most 10 words / 18 Chinese characters.' },
      text: { type: 'string', description: 'The spoken narration, 2–4 sentences, readable aloud in about 15–25 seconds.' },
    },
  },
};

function buildContent(input: ReturnType<typeof validate>) {
  const { place, language, era, current, bridge } = input;
  const focus = era === 'old'
    ? 'the PAST of this place — what it used to be, told warmly and vividly. End by glancing at how it has changed today.'
    : 'the PRESENT of this place — what it is like now, told warmly and vividly. End by recalling what it used to be before.';
  const bridgeLine = bridge
    ? `Use this line about the OTHER side of time as the hook/bridge (rephrase it naturally, do not quote it verbatim): "${bridge}"`
    : (era === 'old'
      ? 'Add a gentle closing hook that this place has changed a lot today.'
      : 'Add a gentle closing hook that this place has a long history behind it.');

  const content: any[] = [{
    type: 'text',
    text: [
      `Write a short spoken narration for a Hong Kong heritage stop called "${place}", in ${LANGUAGE_NOTE[language]}.`,
      `Focus on ${focus}.`,
      'Ground the narration in the notes below. Do not invent people, names, dates, events, food or facts that are not given.',
      'Do not identify or describe any real person by name or appearance.',
      bridgeLine,
      'Keep it 2–4 sentences, warm and vivid, the kind of thing a guide says while the viewer looks around. It should read aloud in about 15–25 seconds.',
      'Return the result only by calling write_narration.',
    ].join('\n'),
  }];

  if (current.length) {
    for (const note of current) {
      content.push({ type: 'text', text: `- ${note.author ? `${note.author}: ` : ''}${note.text}` });
    }
  } else {
    content.push({ type: 'text', text: '(no visitor notes — write from general knowledge of the place name only, keeping it short and safe)' });
  }

  return content;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!API_KEY) return json({ error: 'Time Travel AI is not configured (missing ANTHROPIC_API_KEY).' }, 503);

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
      max_tokens: 1200,
      tools: [NARRATION_TOOL],
      tool_choice: { type: 'tool', name: NARRATION_TOOL.name },
      messages: [{ role: 'user', content: buildContent(input) }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Model request failed', response.status, detail.slice(0, 500));
    return json({ error: `Model request failed (${response.status}).` }, 502);
  }
  const result = await response.json();
  const call = (result.content || []).find((block: any) => block.type === 'tool_use' && block.name === NARRATION_TOOL.name);
  if (!call) return json({ error: 'Model returned no narration.' }, 502);
  return json({ ...call.input, model: MODEL });
});
