// Personalisation over reviewed content (Student C). No LLM needed; works offline.
//
// 1. Time:     picks the longest reviewed length (short/medium/long) that fits the remaining
//              ride time in the chosen language. If none fits, uses the shortest and flags it.
// 2. Interest: prepends a one-sentence lead-in for the user's first interest, only if the
//              result still fits the remaining time.
// 3. Track:    suggests Official or Civilian from the interests (the user's choice always wins).

import { localizeStory } from '../content/stories.js';
import { INTEREST_KEYS, INTEREST_TRACK, interestHooks } from '../content/interestHooks.js';
import { rankInterests } from './profileService.js';

const LENGTHS = ['short', 'medium', 'long'];
const SPEED = { en: 2.5, 'zh-CN': 4.2, 'zh-HK': 4.5 }; // same estimate as stories.js
const MARGIN_SEC = 0; // raise to leave room before the bus reaches the stop

// 四项兴趣 → 每地已有的 hook 句子。architecture/food 已有专用句；
// culture/nature 先落到最接近的现成句，等 C 补专用内容再替换。
const HOOK_KEY = {
  architecture: 'architecture',
  culture: 'official-history',
  food: 'food',
  nature: 'official-history',
};

const estimateSec = (text, language) => {
  const units = language === 'en'
    ? text.trim().split(/\s+/).length
    : (text.match(/[一-鿿]/g) || []).length + (text.match(/\d+/g) || []).length;
  return Math.round(units / (SPEED[language] || 2.5));
};

export const normalizeInterests = (interests = []) =>
  interests.map((i) => INTEREST_KEYS[i] || i).filter((k) => INTEREST_TRACK[k]);

export function recommendTrack(interests = []) {
  const keys = normalizeInterests(interests);
  if (!keys.length) return null;
  const votes = keys.reduce((acc, k) => ({ ...acc, [INTEREST_TRACK[k]]: (acc[INTEREST_TRACK[k]] || 0) + 1 }), {});
  return ['official', 'culture', 'civilian'].reduce(
    (best, track) => (votes[track] || 0) > (votes[best] || 0) ? track : best,
    'official',
  );
}

export function personalizeStory({ place, track = 'official', remainingTimeSec = 45, interests = [], interestProfile = null, language = 'en', maxHooks = 2 }) {
  const tracks = place.stories[track];
  // 普通话/粤语只用 C 已翻译的长度，避免缺翻译时把英文正文塞进中文播报
  let available = LENGTHS.filter((l) => tracks[l] && (language === 'en' || tracks[l].localized?.[language]));
  if (!available.length) available = LENGTHS.filter((l) => tracks[l]); // 兜底：该语言完全无翻译时退回英语档位
  const budget = remainingTimeSec - MARGIN_SEC;
  const localized = Object.fromEntries(available.map((l) => [l, localizeStory(tracks[l], language)]));

  const fitting = [...available].reverse().find((l) => localized[l].durationSec <= budget);
  const servedLength = fitting || available[0];
  const base = localized[servedLength];

  // 兴趣注入：按画像比例取最高项，预算允许再补次高项（至少 1 句、最好 2 句）。
  const ranked = interestProfile ? rankInterests(interestProfile) : normalizeInterests(interests);
  const hooks = [];
  for (const key of ranked) {
    const hookKey = HOOK_KEY[key] || key;
    const sentence = interestHooks[place.id]?.[hookKey]?.[language];
    if (sentence && !hooks.includes(sentence)) hooks.push(sentence);
    if (hooks.length >= maxHooks) break;
  }

  const joiner = language === 'en' ? ' ' : '';
  let text = base.text;
  let durationSec = base.durationSec;
  let interestFocus = null;
  let appliedHooks = [];

  if (hooks.length) {
    const combined = `${hooks.join(joiner)}${joiner}${base.text}`;
    const combinedSec = estimateSec(combined, language);
    // 预算允许放尽量多句，放不下就逐句减到一句。
    let chosen = hooks.length;
    while (chosen > 1 && estimateSec(`${hooks.slice(0, chosen).join(joiner)}${joiner}${base.text}`, language) > budget) chosen--;
    if (estimateSec(`${hooks.slice(0, chosen).join(joiner)}${joiner}${base.text}`, language) <= budget) {
      text = `${hooks.slice(0, chosen).join(joiner)}${joiner}${base.text}`;
      durationSec = estimateSec(text, language);
      interestFocus = ranked[0];
      appliedHooks = hooks.slice(0, chosen);
    }
  }

  return {
    story: {
      ...base,
      text,
      durationSec,
      language,
      length: servedLength,
      interestFocus,
      baseText: base.text,
      hookText: appliedHooks.join(joiner) || null,
    },
    meta: {
      servedLength,
      availableLengths: available,
      fitsRemainingTime: durationSec <= budget,
      interestFocus,
      hookApplied: Boolean(interestFocus),
      recommendedTrack: recommendTrack(interests),
      method: 'rule-based selection from human-reviewed scripts',
    },
  };
}
