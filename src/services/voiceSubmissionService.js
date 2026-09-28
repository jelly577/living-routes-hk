import { getPlaceById } from '../data/places.js';
import { simulateNetwork } from './utils.js';

// Hackathon-safe local fallback for the future WhatsApp voice-note pipeline.
// The UI can pass a real audio File, but no file is uploaded anywhere in the
// MVP. When there is no transcription provider, this reviewed sample keeps the
// demo deterministic and clearly labelled as a demonstration.
const DEMO_TRANSCRIPTS = {
  'blue-house': {
    text: '以前每層住戶共用一個廚房，大家煮飯時會互相照應。藍屋活化之後，原來的居民仍然可以留在這裏。',
    confidence: 0.94,
    language: 'zh-HK',
  },
  'lee-tung-street': {
    text: '以前很多人來利東街印喜帖，街坊和舖頭都知道哪一家最適合自己的婚事。',
    confidence: 0.92,
    language: 'zh-HK',
  },
  'central-market': {
    text: '以前來街市買菜，最重要是和熟悉的檔主打招呼，慢慢就知道哪一檔的菜最新鮮。',
    confidence: 0.91,
    language: 'zh-HK',
  },
};

const GENERATED_STORY = {
  'blue-house': {
    en: {
      title: 'A Shared Kitchen in Blue House',
      text: 'This community memory recalls how families once shared a kitchen on each floor of Blue House. Cooking became a daily meeting point where neighbours looked after one another. The memory also highlights a key part of the building’s revitalisation: original residents were able to stay.',
    },
    'zh-CN': {
      title: '蓝屋里的共享厨房',
      text: '这段社区记忆讲述了蓝屋住户共用楼层厨房的日常。大家在煮饭时互相照应，厨房也成了邻居每天见面的地方。记忆还提醒我们，建筑活化后，原来的居民仍然可以留下。',
    },
    'zh-HK': {
      title: '藍屋入面嘅共享廚房',
      text: '呢段社區記憶講到，以前藍屋每層嘅住戶共用廚房。大家煮飯嗰陣互相照應，廚房亦成為鄰居每日見面嘅地方。呢段記憶亦提醒我哋，建築活化之後，原本嘅居民仍然可以留低。',
    },
  },
  'lee-tung-street': {
    en: {
      title: 'Choosing a Wedding Card on Lee Tung Street',
      text: 'This community memory recalls Lee Tung Street as a place where families came to choose and print wedding cards. The shops were part of the neighbourhood’s everyday preparation for a wedding, not just a retail destination.',
    },
    'zh-CN': {
      title: '在利东街挑选喜帖',
      text: '这段社区记忆把利东街回忆成一个家庭挑选和印制喜帖的地方。那些店铺参与了街坊筹备婚礼的日常，不只是一个购物地点。',
    },
    'zh-HK': {
      title: '喺利東街揀喜帖',
      text: '呢段社區記憶將利東街記成一個家庭揀選同印製喜帖嘅地方。嗰啲舖頭參與咗街坊籌備婚禮嘅日常，唔只係一個買嘢嘅地方。',
    },
  },
  'central-market': {
    en: {
      title: 'The Market Stall You Knew by Name',
      text: 'This community memory recalls Central Market as a place where regular customers greeted familiar stallholders and learned which stalls had the freshest produce. The story focuses on everyday relationships rather than a historical claim.',
    },
    'zh-CN': {
      title: '记得名字的街市档主',
      text: '这段社区记忆讲述了中环街市里的熟客和档主。大家见面会打招呼，也知道哪一档的菜最新鲜。这个故事记录的是日常关系，并不是一项历史事实主张。',
    },
    'zh-HK': {
      title: '記得個名嘅街市檔主',
      text: '呢段社區記憶講到中環街市入面嘅熟客同檔主。大家見面會打招呼，亦知道邊一檔嘅菜最新鮮。呢個故事記錄嘅係日常關係，唔係一項歷史事實主張。',
    },
  },
};

const normalizeTranscript = (transcript, placeId) => {
  const fallback = DEMO_TRANSCRIPTS[placeId] || DEMO_TRANSCRIPTS['blue-house'];
  return {
    text: transcript?.trim() || fallback.text,
    confidence: transcript?.trim() ? 0.88 : fallback.confidence,
    language: fallback.language,
    method: transcript?.trim() ? 'user-provided-transcript' : 'local-reviewed-demo-transcript',
  };
};

export async function processVoiceSubmission({
  audioFile,
  transcript,
  placeId = 'blue-house',
  consent = false,
} = {}) {
  const place = getPlaceById(placeId) || getPlaceById('blue-house');
  const transcription = normalizeTranscript(transcript, place.id);
  const source = GENERATED_STORY[place.id] || GENERATED_STORY['blue-house'];
  const voicePreviewUrl = audioFile && typeof URL !== 'undefined' && URL.createObjectURL
    ? URL.createObjectURL(audioFile)
    : null;

  return simulateNetwork({
    id: `voice-demo-${Date.now()}`,
    demoMode: true,
    input: {
      type: audioFile ? 'audio-upload' : 'sample-voice-note',
      fileName: audioFile?.name || 'blue-house-cantonese-sample.m4a',
      durationSec: audioFile ? null : 14,
      voicePreviewUrl,
      placeId: place.id,
      placeName: place.nameEn,
    },
    transcription,
    extraction: {
      people: ['neighbours / families'],
      time: 'past community life · exact year not claimed',
      place: place.nameEn,
      themes: ['shared routines', 'neighbour care', 'living heritage'],
      factCheckNote: 'Personal memory is kept as a memory; only the place context is checked against project sources.',
    },
    generatedStory: {
      track: 'civilian',
      disclosure: 'Demo sample based on a provided voice-note transcript; not a verified resident submission.',
      languages: source,
    },
    moderation: {
      status: 'needs-human-review',
      flags: [],
      route: 'human-review-queue',
      reason: consent ? 'Consent recorded; review is still required before public publication.' : 'No AI-curation consent; keep private and do not publish.',
    },
    publication: {
      consentForAi: Boolean(consent),
      visibility: consent ? 'pending-review' : 'private',
      eligibleForPublicStoryLibrary: false,
    },
  }, 700);
}
