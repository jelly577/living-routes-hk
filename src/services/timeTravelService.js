// "Time Travel" narration: turns a heritage place's posts into a short spoken
// script that bridges its past and present. Tries the `narrate` Edge Function
// (Claude) first; falls back to a hand-written trilingual template so the
// experience still works without a deployed AI.
import { sharedCommunityEnabled, requestNarrateAi } from './sharedCommunityService.js';

const TITLE = {
  old: {
    en: (name) => `${name} · Back Then`,
    'zh-HK': (name) => `${name} · 舊時光`,
    'zh-CN': (name) => `${name} · 旧时光`,
  },
  new: {
    en: (name) => `${name} · Today`,
    'zh-HK': (name) => `${name} · 今日`,
    'zh-CN': (name) => `${name} · 今天`,
  },
};

// Hand-written hooks used when the AI is unavailable. `lead` is the first
// note's text; when there are no notes we supply a safe generic line.
const TEMPLATE = {
  en: {
    old: (name, lead) =>
      `${lead || `${name} has carried the city's memories for a long time.`} But look around today — the change is striking, yet the memory is still here.`,
    new: (name, lead) =>
      `${lead || `People pass through ${name} every day.`} They say this spot was not always like this — it carries a long history behind it.`,
  },
  'zh-HK': {
    old: (name, lead) =>
      `${lead || `${name}承載住呢座城市好長嘅記憶。`} 不過今日再望，呢度已經變晒樣——但係記憶仲喺度。`,
    new: (name, lead) =>
      `${lead || `每日都有好多人經過${name}。`} 聽講呢度以前唔係咁㗎——背後有段好長嘅歷史。`,
  },
  'zh-CN': {
    old: (name, lead) =>
      `${lead || `${name}承载着这座城市很长的记忆。`} 不过今天再看，这里已经变了模样——但记忆还在。`,
    new: (name, lead) =>
      `${lead || `每天都有很多人经过${name}。`} 听说这里以前不是这样的——背后有段很长的历史。`,
  },
};

function templateNarration({ place, era, language, notes }) {
  const name = place?.nameEn || place?.nameZh || place?.id || '';
  const lead = notes?.[0]?.text || '';
  const tpl = TEMPLATE[language] || TEMPLATE.en;
  return {
    title: (TITLE[era]?.[language] || TITLE[era]?.en)(name),
    text: tpl[era](name, lead),
    source: 'template',
  };
}

// Generate the narration for one side of the time machine.
//   era      — 'old' | 'new'
//   notes    — [{ text, author? }] posts/stories for THIS side
//   bridge   — a one-line summary of the OTHER side, for the AI's hook
export async function generateNarration({ place, era, language, notes, bridge }) {
  const request = {
    place: place?.nameEn || place?.nameZh || place?.id,
    language,
    era,
    current: (notes || []).map((n) => ({ text: n.text, author: n.author })),
    bridge: bridge || '',
  };
  // Skip the AI round-trip entirely when Supabase isn't configured, so the
  // local template plays immediately instead of waiting on a doomed network call.
  if (sharedCommunityEnabled) {
    try {
      const data = await requestNarrateAi(request);
      if (data?.text) return { title: data.title || '', text: data.text, source: 'ai' };
    } catch {
      // fall through to the template below
    }
  }
  return templateNarration({ place, era, language, notes });
}

// Wrap a generated script as a story the narrator can play.
export function narrationStory(place, { title, text }) {
  return {
    placeId: place?.id,
    track: 'time-travel',
    length: 'medium',
    title,
    text,
  };
}
