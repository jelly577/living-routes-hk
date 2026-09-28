// Personalisation over reviewed content (Student C). No LLM needed; works offline.
//
// 1. Time:     picks the longest reviewed length (short/medium/long) that fits the remaining
//              ride time in the chosen language. If none fits, uses the shortest and flags it.
// 2. Interest: prepends a one-sentence lead-in for the user's first interest, only if the
//              result still fits the remaining time.
// 3. Track:    suggests Official or Civilian from the interests (the user's choice always wins).

import { localizeStory } from '../content/stories.js';
import { INTEREST_KEYS, INTEREST_TRACK, interestHooks } from '../content/interestHooks.js';

const LENGTHS = ['short', 'medium', 'long'];
const SPEED = { en: 2.5, 'zh-CN': 4.2, 'zh-HK': 4.5 }; // same estimate as stories.js
const MARGIN_SEC = 0; // raise to leave room before the bus reaches the stop

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
  return (votes.civilian || 0) > (votes.official || 0) ? 'civilian' : 'official';
}

export function personalizeStory({ place, track = 'official', remainingTimeSec = 45, interests = [], language = 'en' }) {
  const tracks = place.stories[track];
  const available = LENGTHS.filter((l) => tracks[l]);
  const budget = remainingTimeSec - MARGIN_SEC;
  const localized = Object.fromEntries(available.map((l) => [l, localizeStory(tracks[l], language)]));

  const fitting = [...available].reverse().find((l) => localized[l].durationSec <= budget);
  const servedLength = fitting || available[0];
  const base = localized[servedLength];

  const focus = normalizeInterests(interests)[0] || null;
  const hook = focus ? interestHooks[place.id]?.[focus]?.[language] : null;
  const joiner = language === 'en' ? ' ' : '';
  let text = base.text;
  let durationSec = base.durationSec;
  let hookApplied = false;
  if (hook) {
    const withHook = `${hook}${joiner}${base.text}`;
    const withHookSec = estimateSec(withHook, language);
    // Short slots stay short: only add the lead-in if it still fits.
    if (withHookSec <= budget) {
      text = withHook;
      durationSec = withHookSec;
      hookApplied = true;
    }
  }

  return {
    story: { ...base, text, durationSec, language, length: servedLength, interestFocus: hookApplied ? focus : null },
    meta: {
      servedLength,
      availableLengths: available,
      fitsRemainingTime: durationSec <= budget,
      interestFocus: focus,
      hookApplied,
      recommendedTrack: recommendTrack(interests),
      method: 'rule-based selection from human-reviewed scripts',
    },
  };
}
