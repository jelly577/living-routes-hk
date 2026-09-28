// Living Routes HK — narration scripts (Student C: content & voice)
// 18 scripts: Central Market / Court of Final Appeal / Happy Valley = medium only;
// Lee Tung Street / Blue House = short + medium + long. Official + Civilian for each.
//
// Rules followed:
// - Official scripts only restate facts found in the listed sources (no AI-added history).
// - Civilian scripts are adapted from PUBLIC reporting / operator material. No invented
//   residents; every civilian script carries a disclosure and its sources.
// - reviewStatus stays 'draft-needs-human-review' until a teammate checks each script
//   against its sources, then change it to 'human-reviewed'.

import { storyTranslations } from './storyTranslations.js';

export const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-HK']; // English / Mandarin (Simplified) / Cantonese (Traditional)

// Approx. TTS speed at rate 1.0: English words/sec, Chinese characters/sec.
const SPEED = { en: 2.5, 'zh-CN': 4.2, 'zh-HK': 4.5 };

const estimateSec = (text, language = 'en') => {
  const units = language === 'en'
    ? text.trim().split(/\s+/).length
    : (text.match(/[\u4e00-\u9fff]/g) || []).length + (text.match(/\d+/g) || []).length;
  return Math.round(units / SPEED[language]);
};

const CIVILIAN_DISCLOSURE = 'Adapted from public sources; not a verified resident submission.';
const CIVILIAN_DISCLOSURE_I18N = {
  en: CIVILIAN_DISCLOSURE,
  'zh-CN': '根据公开资料改编，并非经核实的居民投稿。',
  'zh-HK': '根據公開資料改編，並非經核實嘅居民投稿。',
};

const SRC = {
  amoCentralMarket: 'https://www.amo.gov.hk/sc/heritage-trails/cw-trails/sheungwan/section-a/a2/index.html',
  devbCentralMarket: 'https://www.devb.gov.hk/en/issues_in_focus/conserving_central/central_market/index.html',
  uraCentralMarket: 'https://www.ura.org.hk/en/project/heritage-preservation-and-revitalisation/central-market',
  hkfpCentralMarket: 'https://hongkongfp.com/2021/08/26/hong-kongs-central-market-comes-back-to-life-but-conservationist-takes-issue-with-gentrification/',
  amoCfa: 'https://www.amo.gov.hk/en/historic-buildings/monuments/hong-kong-island/monuments_26/index.html',
  wikiCfa: 'https://en.wikipedia.org/wiki/Court_of_Final_Appeal_Building',
  wikiStatueSquare: 'https://en.wikipedia.org/wiki/Statue_Square',
  scmpStatueSquare: 'https://www.scmp.com/lifestyle/travel-leisure/article/2184584/hong-kongs-seat-power-statue-square-its-colonial-history',
  uraLeeTung: 'https://www.ura.org.hk/en/project/redevelopment/lee-tung-street-mcgregor-street-project',
  wikiLeeTung: 'https://en.wikipedia.org/wiki/Lee_Tung_Street',
  hkfpLeeTung: 'https://hongkongfp.com/2016/02/01/wedding-card-st-to-be-turned-into-first-class-shopping-district-developers-accused-of-backtracking/',
  heritageBlueHouse: 'https://www.heritage.gov.hk/en/about-us/revitalisation-scheme/viva-blue-house/index.html',
  heritageBlueHouseTour: 'https://www.heritage.gov.hk/en/revitalisation-scheme/batch-ii-of-revitalisation-scheme/virtual-tour-on-batch-ii-historic-buildings/the-blue-house-cluster/index.html',
  sjsBlueHouse: 'https://www.sjs.org.hk/en/media/press-detail.php?id=18',
  sjsBlueHouseWalk: 'https://artsandculture.google.com/story/walking-tour-of-the-blue-house-st-james-settlement-%E8%81%96%E9%9B%85%E5%90%84%E7%A6%8F%E7%BE%A4%E6%9C%83/BQURvFMz5yygKw?hl=en',
  amoFireMemorial: 'https://www.amo.gov.hk/en/historic-buildings/monuments/hong-kong-island/monuments_110/index.html',
  twghsFireMemorial: 'https://rho.tungwah.org.hk/en/built-heritage/3',
  scmpFire: 'https://www.scmp.com/magazines/post-magazine/short-reads/article/2134472/when-600-died-fire-hong-kong-racecourse-100',
};

const story = ({ placeId, track, length, title, text, sourceUrls }) => {
  const zh = storyTranslations[`${placeId}.${track}.${length}`] || {};
  const localized = { en: { title, text } };
  for (const lang of ['zh-CN', 'zh-HK']) if (zh[lang]) localized[lang] = { ...zh[lang] };
  for (const [lang, entry] of Object.entries(localized)) {
    entry.durationSec = estimateSec(entry.text, lang);
    if (track === 'civilian') entry.disclosure = CIVILIAN_DISCLOSURE_I18N[lang];
  }
  return {
  placeId,
  track,
  trackLabel: track === 'official' ? 'Official Heritage' : 'Civilian Voices',
  contentType: track === 'official' ? 'heritage-facts' : 'local-voices-demo',
  contentTypeLabel: track === 'official' ? 'Heritage Facts' : 'Local Voices · Demo adaptation',
  length,
  title,
  text,
  durationSec: estimateSec(text),
  language: 'en',
  sourceUrls,
  ...(track === 'civilian' ? { disclosure: CIVILIAN_DISCLOSURE } : {}),
  status: 'draft',
  reviewStatus: 'draft-needs-human-review',
  // All three language versions; `title`/`text`/`durationSec` above = English default.
  languages: Object.keys(localized),
  localized,
  };
};

export const storiesByPlace = {
  // ───────────────────────── 1. Central Market ─────────────────────────
  'central-market': {
    official: {
      medium: story({
        placeId: 'central-market', track: 'official', length: 'medium',
        title: 'Central Market: Four Markets on One Site',
        text: 'Coming up on Des Voeux Road Central is Central Market. Chinese residents were already running a market in this area as early as 1842. The building you see today is the fourth market here, completed in 1939 in the Streamline Moderne style. Look for its long, slim horizontal lines. It stopped working as a market in March 2003. After restoration by the Urban Renewal Authority, it reopened in phases from August 2021, with a public atrium of about one thousand square metres at its heart.',
        sourceUrls: [SRC.amoCentralMarket, SRC.devbCentralMarket, SRC.uraCentralMarket, SRC.hkfpCentralMarket],
      }),
    },
    civilian: {
      medium: story({
        placeId: 'central-market', track: 'civilian', length: 'medium',
        title: 'Central Market: What Should a Market Keep?',
        text: 'This story is adapted from public reporting. When Central Market reopened in 2021, not everyone felt at home. Of more than two hundred original stalls, thirteen were kept. Conservationist Katty Law had hoped for more market stalls, and said the place suited shops like wonton or fish ball noodles. One visitor, Ms Lam, told Hong Kong Free Press that they had kept the look of the building, but inside it felt totally unrelated. As we pass, ask yourself: when an old market is renewed, what should it keep?',
        sourceUrls: [SRC.hkfpCentralMarket],
      }),
    },
  },

  // ─────────────────────── 2. Court of Final Appeal ───────────────────────
  'court-of-final-appeal': {
    official: {
      medium: story({
        placeId: 'court-of-final-appeal', track: 'official', length: 'medium',
        title: 'Court of Final Appeal: Justice in a Blindfold',
        text: 'Look up at the granite building beside Statue Square. On its central pediment stands Themis, the blindfolded Greek goddess of justice. This neo-classical building, with its tall Ionic columns, opened in January 1912 as the Supreme Court. It sits on reclaimed land, supported by hundreds of piles made from Chinese fir trees. From 1985 to 2011 it housed the Legislative Council, and since 2015 it has been home to the Court of Final Appeal.',
        sourceUrls: [SRC.amoCfa],
      }),
    },
    civilian: {
      medium: story({
        placeId: 'court-of-final-appeal', track: 'civilian', length: 'medium',
        title: 'Court of Final Appeal: Sundays at the Square',
        text: 'This story is adapted from public sources. On weekdays, the square in front of this court belongs to office workers and traffic. Sundays look different. Since the 1980s, thousands of Filipina domestic workers have gathered in and around Statue Square on their usual day off. Right beside the statue of Justice, one of the most formal corners of the city becomes a weekly meeting place for the women who help keep Hong Kong homes running. If you ride this route on a Sunday, look out of the window.',
        sourceUrls: [SRC.wikiStatueSquare, SRC.scmpStatueSquare],
      }),
    },
  },

  // ───────────────────────── 3. Lee Tung Street ─────────────────────────
  'lee-tung-street': {
    official: {
      short: story({
        placeId: 'lee-tung-street', track: 'official', length: 'short',
        title: 'Lee Tung Street in Brief',
        text: 'Nearby is Lee Tung Street, once known as Wedding Card Street for its printing shops. It was redeveloped by the Urban Renewal Authority and reopened in 2015.',
        sourceUrls: [SRC.wikiLeeTung, SRC.uraLeeTung],
      }),
      medium: story({
        placeId: 'lee-tung-street', track: 'official', length: 'medium',
        title: 'Lee Tung Street: From Wedding Cards to Lee Tung Avenue',
        text: 'From the 1950s, printing shops gathered on Lee Tung Street in Wan Chai. By the 1970s and 1980s they were famous for wedding invitations, lai see envelopes and fai chun, and the street became known as Wedding Card Street. In 2003 the Urban Renewal Authority announced plans to redevelop Lee Tung Street and McGregor Street, and demolition began in 2007. The new Lee Tung Avenue opened in 2015, with more than twelve hundred flats, shops, and three preserved tenement houses on Queen\'s Road East.',
        sourceUrls: [SRC.wikiLeeTung, SRC.uraLeeTung],
      }),
      long: story({
        placeId: 'lee-tung-street', track: 'official', length: 'long',
        title: 'Lee Tung Street: A Redevelopment Story',
        text: 'Nearby is Lee Tung Street. From the 1950s, printing shops gathered here, and by the 1970s and 1980s the street was famous across Hong Kong for wedding invitations, lai see envelopes and fai chun. People called it Wedding Card Street. In 2003 the Urban Renewal Authority announced a redevelopment of Lee Tung Street and McGregor Street. According to the Authority, the project affected eighty five buildings and more than sixteen hundred residents. Residents and shop owners formed the H15 Concern Group. In 2005, architect Christopher Law drew up the Dumbbell Proposal, which would have kept the street\'s signature six storey tenement buildings. It won a silver award from the Hong Kong Institute of Planners, but the Town Planning Board rejected it in 2007, and demolition began that December. The new Lee Tung Avenue opened in 2015. It includes twelve hundred and seventy five flats, shops, public open space, three preserved pre-war tenement houses on Queen\'s Road East, and wedding themed design elements that nod to the street\'s past.',
        sourceUrls: [SRC.uraLeeTung, SRC.wikiLeeTung],
      }),
    },
    civilian: {
      short: story({
        placeId: 'lee-tung-street', track: 'civilian', length: 'short',
        title: 'Wedding Card Street, Remembered',
        text: 'Adapted from public reporting. A worker at one wedding card printer put it simply: the spirit of Wedding Card Street was much better before.',
        sourceUrls: [SRC.hkfpLeeTung],
      }),
      medium: story({
        placeId: 'lee-tung-street', track: 'civilian', length: 'medium',
        title: 'Wedding Card Street: The Shops That Moved Away',
        text: 'This story is adapted from public reporting. When Wedding Card Street was cleared, many printing shops had to find new homes. Reports described one shop owner losing about eighty percent of his business after moving, and another about forty percent. Years later, the H15 Concern Group said high rents and strict lease terms kept the old traders from returning. A worker at one wedding card printer told Hong Kong Free Press that the spirit of the street was much better before.',
        sourceUrls: [SRC.wikiLeeTung, SRC.hkfpLeeTung],
      }),
      long: story({
        placeId: 'lee-tung-street', track: 'civilian', length: 'long',
        title: 'Wedding Card Street: Voices from the Street',
        text: 'This story is adapted from public reporting. For decades, people from all over Hong Kong came to Lee Tung Street to order their wedding cards. When redevelopment came, the people who ran those shops did not simply leave. They formed the H15 Concern Group to campaign against the plan. One sixty-year-old shop owner even joined a three-day hunger strike against the demolition. Demolition began in 2007, and the shops moved away. Reports described one owner losing about eighty percent of his business after relocating, and another about forty percent after moving to Tai Wong Street East. Compensation was about four thousand dollars per square foot. In 2013, new flats on the site sold for about twenty three thousand. The new street kept a wedding theme, but a planned space for social enterprises was proposed at about one hundred and sixty thousand dollars a month in rent. A worker at one wedding card printer said the spirit of the street was much better before.',
        sourceUrls: [SRC.wikiLeeTung, SRC.hkfpLeeTung],
      }),
    },
  },

  // ─────────────────────────── 4. Blue House ───────────────────────────
  'blue-house': {
    official: {
      short: story({
        placeId: 'blue-house', track: 'official', length: 'short',
        title: 'Blue House in Brief',
        text: 'Nearby is the Blue House, a Grade One historic building in Wan Chai. It was revitalised while keeping its residential use.',
        sourceUrls: [SRC.heritageBlueHouse],
      }),
      medium: story({
        placeId: 'blue-house', track: 'official', length: 'medium',
        title: 'Blue House Cluster: Three Colours, One Street',
        text: 'Nearby, on Stone Nullah Lane, is the Blue House Cluster: the Blue House, the Yellow House and the Orange House, tenement buildings from the 1920s to the 1950s. The Blue House site once held Wah To Hospital, possibly the first Chinese medical facility in Wan Chai. It later became a temple for the God of Medicine, and in the 1950s and 1960s a martial arts school and an acupuncture clinic. Revitalised as Viva Blue House, it kept its residential use and won a UNESCO Award of Excellence in 2017.',
        sourceUrls: [SRC.heritageBlueHouse, SRC.heritageBlueHouseTour],
      }),
      long: story({
        placeId: 'blue-house', track: 'official', length: 'long',
        title: 'Blue House Cluster: Keeping the Houses and the People',
        text: 'Nearby, on Stone Nullah Lane, stands the Blue House Cluster. It is made up of three tenement buildings from the 1920s to the 1950s, each named after the colour of its walls: blue, yellow and orange. The Blue House is a Grade One historic building. Its site once held Wah To Hospital, possibly the first Chinese medical facility in Wan Chai. Later it became a temple for the God of Medicine, then a martial arts school in the 1950s and an acupuncture clinic in the 1960s. Look for the four storey brick shophouses, the timber stairs shared between blocks, and the cantilevered balconies with ornamental ironwork. The Yellow House, from the 1920s, has neo-classical pediments, while the Orange House, from the 1950s, replaced a timber yard. Under the government\'s revitalisation scheme, the cluster became Viva Blue House, run with the aim of retaining both the residents and the buildings. In 2017 it received the Award of Excellence in the UNESCO Asia-Pacific Awards for Cultural Heritage Conservation.',
        sourceUrls: [SRC.heritageBlueHouse, SRC.heritageBlueHouseTour, SRC.sjsBlueHouse],
      }),
    },
    civilian: {
      short: story({
        placeId: 'blue-house', track: 'civilian', length: 'short',
        title: 'Blue House: One Flat, Seven People',
        text: 'Adapted from the operator\'s walking tour. In the 1950s and 1960s, six or seven family members might share a single partitioned flat in the Blue House.',
        sourceUrls: [SRC.sjsBlueHouseWalk],
      }),
      medium: story({
        placeId: 'blue-house', track: 'civilian', length: 'medium',
        title: 'Blue House: Life Up the Wooden Stairs',
        text: 'This story is adapted from the operator\'s walking tour. In the 1950s and 1960s, six or seven family members might share one partitioned flat here. Families on each floor shared a kitchen, so neighbours met every day over the stove. There was no flush toilet in the whole building. To use the bathroom, residents walked down the wooden stairs to a public toilet. Those same wooden stairs and floors are still here today, and so are some of the families: the walking tour notes that eight families live in the cluster.',
        sourceUrls: [SRC.sjsBlueHouseWalk],
      }),
      long: story({
        placeId: 'blue-house', track: 'civilian', length: 'long',
        title: 'Blue House: Neighbours, Then and Now',
        text: 'This story is adapted from the operator\'s walking tour and public materials. In the 1950s and 1960s, six or seven family members might share one partitioned flat in the Blue House. For families who could not afford even that, rooms were divided again into smaller spaces. Each floor shared a kitchen, and a staircase from the third floor kitchen led up to the roof. There was no flush toilet in the whole building, so residents walked down the wooden stairs to a public toilet. When the buildings were revitalised, the old residents were not moved out. The operator describes its mission as retaining both the residents and the buildings. A Good Neighbours Scheme encourages people to share their time and skills, and small social enterprises, like a vegetarian bistro and a dessert house, now sit beside family homes. UNESCO called it an unprecedented civic effort to protect marginalised local heritage. Just a few minutes away is Lee Tung Street. Two streets, two different answers to the same question: when a city renews itself, who gets to stay?',
        sourceUrls: [SRC.sjsBlueHouseWalk, SRC.sjsBlueHouse],
      }),
    },
  },

  // ───────────────── 5. Happy Valley Racecourse / Fire Memorial ─────────────────
  // Content warning: fatal fire. Keep wording calm and respectful.
  'happy-valley-racecourse': {
    official: {
      medium: story({
        placeId: 'happy-valley-racecourse', track: 'official', length: 'medium',
        title: 'Happy Valley: The Race Course Fire Memorial',
        text: 'We are approaching Happy Valley Racecourse. On the twenty sixth of February, 1918, during the annual Derby Day races, temporary bamboo stands collapsed and caught fire. More than six hundred people, of many nationalities and backgrounds, lost their lives. Tung Wah Hospital led relief work. In 1922, a memorial funded by public donations was built at So Kon Po, above today\'s Hong Kong Stadium. It blends Chinese and Western design, and its central arch carries the characters for fortune, richness and long life. It was declared a monument in 2015.',
        sourceUrls: [SRC.amoFireMemorial, SRC.twghsFireMemorial],
      }),
    },
    civilian: {
      medium: story({
        placeId: 'happy-valley-racecourse', track: 'civilian', length: 'medium',
        title: 'Happy Valley: Remembering 1918',
        text: 'This story is adapted from historical records and newspaper reports. In February 1918, more than ten thousand people came to watch the Lunar New Year races. Spectators crowded onto temporary bamboo and matting stands. When the stands gave way, a fire spread quickly. Newspapers of the time wrote of rescuers who kept working until the flames reached them. Afterwards, Tung Wah Hospital led relief work and helped recover the victims. At the memorial, plaques remember them as men and women from the East and West, named in Chinese and English. As we pass, you may wish to take a quiet moment.',
        sourceUrls: [SRC.twghsFireMemorial, SRC.scmpFire, SRC.amoFireMemorial],
      }),
    },
  },
};

export const allStories = Object.values(storiesByPlace).flatMap((tracks) =>
  Object.values(tracks).flatMap((lengths) => Object.values(lengths)),
);

// Returns the story with title/text/durationSec/disclosure swapped to the requested
// language ('en' | 'zh-CN' | 'zh-HK'); falls back to English if missing.
export const localizeStory = (storyObj, language = 'en') => {
  const entry = storyObj?.localized?.[language];
  if (!entry) return storyObj;
  return { ...storyObj, ...entry, language };
};
