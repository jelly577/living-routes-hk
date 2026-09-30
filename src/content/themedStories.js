// Living Routes HK — interest-themed route narration (Student C)
//
// One story per stop, written for a theme picked at onboarding, instead of
// three separate tabs. First theme: Architecture + History.
//
// Rules (same as stories.js):
// - Only restates facts already in the reviewed official scripts / interest hooks
//   and their listed sources. No AI-added history.
// - The five stops share one thread: when the city renews itself, what does it keep?
//   (market reused → courthouse reused → street demolished → houses and people kept → memorial)
// - Happy Valley covers a fatal fire: calm, factual wording only.
// - reviewStatus stays 'draft-needs-human-review' until a teammate checks it.

const SPEED = { en: 2.5, 'zh-CN': 4.2, 'zh-HK': 4.5 };
const estimateSec = (text, language) => {
  const units = language === 'en'
    ? text.trim().split(/\s+/).length
    : (text.match(/[一-鿿]/g) || []).length + (text.match(/\d+/g) || []).length;
  return Math.round(units / SPEED[language]);
};

const SRC = {
  amoCentralMarket: 'https://www.amo.gov.hk/sc/heritage-trails/cw-trails/sheungwan/section-a/a2/index.html',
  uraCentralMarket: 'https://www.ura.org.hk/en/project/heritage-preservation-and-revitalisation/central-market',
  amoCfa: 'https://www.amo.gov.hk/en/historic-buildings/monuments/hong-kong-island/monuments_26/index.html',
  uraLeeTung: 'https://www.ura.org.hk/en/project/redevelopment/lee-tung-street-mcgregor-street-project',
  wikiLeeTung: 'https://en.wikipedia.org/wiki/Lee_Tung_Street',
  heritageBlueHouse: 'https://www.heritage.gov.hk/en/about-us/revitalisation-scheme/viva-blue-house/index.html',
  heritageBlueHouseTour: 'https://www.heritage.gov.hk/en/revitalisation-scheme/batch-ii-of-revitalisation-scheme/virtual-tour-on-batch-ii-historic-buildings/the-blue-house-cluster/index.html',
  amoFireMemorial: 'https://www.amo.gov.hk/en/historic-buildings/monuments/hong-kong-island/monuments_110/index.html',
  twghsFireMemorial: 'https://rho.tungwah.org.hk/en/built-heritage/3',
};

export const THEMES = {
  'architecture-history': {
    interests: ['architecture', 'history', 'official-history'],
    label: { en: 'Architecture · History', 'zh-CN': '建筑 · 历史', 'zh-HK': '建築 · 歷史' },
  },
};

const themed = ({ placeId, theme, length, sourceUrls, en, zhCN, zhHK }) => {
  const localized = { en, 'zh-CN': zhCN, 'zh-HK': zhHK };
  for (const [lang, entry] of Object.entries(localized)) entry.durationSec = estimateSec(entry.text, lang);
  return {
    placeId,
    track: 'themed',
    theme,
    themeLabel: THEMES[theme].label.en,
    contentType: 'themed-narration',
    contentTypeLabel: 'Personalised narration',
    length,
    ...en,
    language: 'en',
    sourceUrls,
    status: 'draft',
    reviewStatus: 'draft-needs-human-review',
    languages: Object.keys(localized),
    localized,
  };
};

export const themedStories = {
  // ───────────── 1. Central Market ─────────────
  'central-market': {
    'architecture-history': {
      short: themed({
        placeId: 'central-market', theme: 'architecture-history', length: 'short',
        sourceUrls: [SRC.amoCentralMarket, SRC.uraCentralMarket],
        en: { title: 'Central Market: The Fourth Market', text: 'Coming up is Central Market, the fourth market on this site, built in 1939 in the Streamline Moderne style. Look for its long horizontal lines.' },
        zhCN: { title: '中环街市：第四代街市', text: '前方是中环街市，这里的第四代街市，1939年落成，属流线型现代主义风格。留意外墙修长的水平线条。' },
        zhHK: { title: '中環街市：第四代街市', text: '前面係中環街市，呢度嘅第四代街市，1939年落成，屬流線型現代主義風格。留意吓外牆修長嘅橫線條。' },
      }),
      medium: themed({
        placeId: 'central-market', theme: 'architecture-history', length: 'medium',
        sourceUrls: [SRC.amoCentralMarket, SRC.uraCentralMarket],
        en: {
          title: 'Central Market: Four Markets, One Site',
          text: 'Our route starts with a question: when a city renews itself, what does it keep? Coming up on Des Voeux Road Central is the first answer. Chinese residents were already trading here in 1842, and the building you see is the fourth market on this site, completed in 1939. Its style is Streamline Moderne: long, slim horizontal lines that make the building look like it is moving. It stopped working as a market in March 2003. Instead of being torn down, it was restored by the Urban Renewal Authority and reopened in phases from 2021. Here, the city kept the shell and gave the inside a new use.',
        },
        zhCN: {
          title: '中环街市：同一地点的四代街市',
          text: '这条路线想和你一起思考一个问题：一座城市更新的时候，会留下什么？前方德辅道中的中环街市，是第一个答案。早在1842年，华人已在这一带开设市场；你眼前的建筑是这里的第四代街市，1939年落成，属流线型现代主义风格，修长的水平线条让整座楼看起来像在前进。它在2003年3月停止作为街市运作，但没有被拆掉，而是由市区重建局修复，从2021年起分阶段重开。在这里，城市保留了外壳，给了里面新的用途。',
        },
        zhHK: {
          title: '中環街市：同一個地方嘅四代街市',
          text: '呢條路線想同你一齊諗一個問題：一個城市更新嘅時候，會留低啲乜？前面德輔道中嘅中環街市，係第一個答案。早喺1842年，華人已經喺呢一帶開市場；你見到嘅建築係呢度嘅第四代街市，1939年落成，屬流線型現代主義風格，修長嘅橫線條令成座樓好似向前行緊咁。佢喺2003年3月停止做街市，但冇被拆，而係由市區重建局修復，由2021年開始分階段重開。喺呢度，城市保留咗外殼，俾咗入面一個新用途。',
        },
      }),
    },
  },

  // ───────────── 2. Court of Final Appeal ─────────────
  'court-of-final-appeal': {
    'architecture-history': {
      short: themed({
        placeId: 'court-of-final-appeal', theme: 'architecture-history', length: 'short',
        sourceUrls: [SRC.amoCfa],
        en: { title: 'One Building, Three Institutions', text: 'Beside Statue Square, this granite neo-classical building has been the Supreme Court, the Legislative Council, and since 2015, the Court of Final Appeal.' },
        zhCN: { title: '一座建筑，三个机构', text: '皇后像广场旁这座花岗岩新古典主义建筑，先后是最高法院、立法会，2015年起成为终审法院。' },
        zhHK: { title: '一座建築，三個機構', text: '皇后像廣場隔籬呢座花崗岩新古典主義建築，先後做過最高法院、立法會，2015年起係終審法院。' },
      }),
      medium: themed({
        placeId: 'court-of-final-appeal', theme: 'architecture-history', length: 'medium',
        sourceUrls: [SRC.amoCfa],
        en: {
          title: 'Court of Final Appeal: One Building, Three Institutions',
          text: 'Look up at the granite building beside Statue Square. Tall Ionic columns, and on the central pediment, Themis, the blindfolded goddess of justice. It opened in January 1912 as the Supreme Court. Because it stands on reclaimed land, it rests on hundreds of piles made from Chinese fir trees. The building stayed, but what happened inside it changed: from 1985 to 2011 it housed the Legislative Council, and since 2015 it has been home to the Court of Final Appeal. Like the market we just passed, the city kept the building and gave it a new role.',
        },
        zhCN: {
          title: '终审法院：一座建筑，三个机构',
          text: '抬头看看皇后像广场旁这座花岗岩建筑：高大的爱奥尼式柱，正中山墙上站着蒙眼的正义女神忒弥斯。它在1912年1月作为最高法院启用。因为建在填海地上，整座建筑由数百根杉木桩支撑。建筑一直都在，里面的角色却换了：1985年至2011年，立法会设于此处；2015年起，这里成为终审法院。和刚才的中环街市一样，城市留下了建筑，给了它新的身份。',
        },
        zhHK: {
          title: '終審法院：一座建築，三個機構',
          text: '抬頭睇吓皇后像廣場隔籬呢座花崗岩建築：高大嘅愛奧尼式柱，正中山牆上面企住蒙住眼嘅正義女神忒彌斯。佢喺1912年1月作為最高法院啟用。因為建喺填海地上面，成座建築由幾百條杉木樁撐住。建築一直都喺度，入面嘅角色就換咗：1985年至2011年，立法會設喺度；2015年起，呢度變成終審法院。同頭先嘅中環街市一樣，城市留低咗建築，俾咗佢一個新身份。',
        },
      }),
    },
  },

  // ───────────── 3. Lee Tung Street ─────────────
  'lee-tung-street': {
    'architecture-history': {
      short: themed({
        placeId: 'lee-tung-street', theme: 'architecture-history', length: 'short',
        sourceUrls: [SRC.wikiLeeTung, SRC.uraLeeTung],
        en: { title: 'Lee Tung Street: What Was Not Kept', text: 'Nearby is Lee Tung Street, once Wedding Card Street. It was demolished from 2007 and rebuilt; only three pre-war tenement houses on Queen\'s Road East were kept.' },
        zhCN: { title: '利东街：没有留下的', text: '附近是利东街，昔日的喜帖街。2007年起拆卸重建，只保留了皇后大道东上三幢战前唐楼。' },
        zhHK: { title: '利東街：冇留低嘅', text: '附近係利東街，以前嘅喜帖街。2007年起拆卸重建，只保留咗皇后大道東三幢戰前唐樓。' },
      }),
      medium: themed({
        placeId: 'lee-tung-street', theme: 'architecture-history', length: 'medium',
        sourceUrls: [SRC.wikiLeeTung, SRC.uraLeeTung],
        en: {
          title: 'Lee Tung Street: The Street That Was Rebuilt',
          text: 'Nearby is Lee Tung Street, where the answer to our question changes. From the 1950s, printing shops lined this street, and it became known as Wedding Card Street. In 2003 the Urban Renewal Authority announced its redevelopment. In 2005, architect Christopher Law drew up the Dumbbell Proposal, which would have kept the street\'s six-storey tenement buildings, but the Town Planning Board rejected it in 2007, and demolition began that December. The new Lee Tung Avenue opened in 2015. Of the old streetscape, three pre-war tenement houses on Queen\'s Road East were kept. Here, most of the buildings did not stay.',
        },
        zhCN: {
          title: '利东街：被重建的一条街',
          text: '附近的利东街，给出了不一样的答案。从1950年代起，这条街开满印刷店，后来被称为喜帖街。2003年，市区重建局宣布重建计划。2005年，建筑师罗健中提出"哑铃方案"，希望保留街上的六层唐楼，但城市规划委员会在2007年否决了方案，同年12月开始拆卸。新的利东街在2015年开放，旧街景中只保留了皇后大道东上三幢战前唐楼。在这里，大部分建筑没有留下来。',
        },
        zhHK: {
          title: '利東街：被重建嘅一條街',
          text: '附近嘅利東街，俾咗一個唔同嘅答案。由1950年代開始，呢條街開滿印刷舖，後來叫做喜帖街。2003年，市區重建局宣佈重建計劃。2005年，建築師羅健中提出「啞鈴方案」，想保留街上嘅六層唐樓，但城市規劃委員會喺2007年否決咗，同年12月開始拆卸。新嘅利東街喺2015年開放，舊街景入面只保留咗皇后大道東三幢戰前唐樓。喺呢度，大部分建築都冇留低。',
        },
      }),
    },
  },

  // ───────────── 4. Blue House Cluster ─────────────
  'blue-house': {
    'architecture-history': {
      short: themed({
        placeId: 'blue-house', theme: 'architecture-history', length: 'short',
        sourceUrls: [SRC.heritageBlueHouse],
        en: { title: 'Blue House: Houses and People Kept', text: 'Nearby is the Blue House, a Grade One historic building. It was revitalised while keeping both the buildings and their residents.' },
        zhCN: { title: '蓝屋：房子和人都留下了', text: '附近是蓝屋，一级历史建筑。它在活化时，房子和住户都留了下来。' },
        zhHK: { title: '藍屋：屋同人都留低咗', text: '附近係藍屋，一級歷史建築。佢活化嗰陣，屋同住戶都留低咗。' },
      }),
      medium: themed({
        placeId: 'blue-house', theme: 'architecture-history', length: 'medium',
        sourceUrls: [SRC.heritageBlueHouse, SRC.heritageBlueHouseTour],
        en: {
          title: 'Blue House Cluster: Keeping the Houses and the People',
          text: 'Just a few minutes from Lee Tung Street, on Stone Nullah Lane, is a very different answer: the Blue House Cluster, tenement buildings from the 1920s to the 1950s. Look for the four-storey brick shophouses, the timber stairs, and the cantilevered balconies with ornamental ironwork. The site once held Wah To Hospital, possibly the first Chinese medical facility in Wan Chai, then a temple for the God of Medicine, a martial arts school and an acupuncture clinic. When it was revitalised as Viva Blue House, both the buildings and the residents stayed. In 2017 it won a UNESCO Award of Excellence.',
        },
        zhCN: {
          title: '蓝屋建筑群：房子和人一起留下',
          text: '离利东街只有几分钟路程的石水渠街，给出了完全不同的答案：蓝屋建筑群，一组1920年代至1950年代的唐楼。留意四层高的砖砌唐楼、木楼梯，以及带装饰铁栏的悬臂式露台。这里曾是华佗医院，可能是湾仔第一所华人医疗机构，后来先后成为华佗庙、武馆和针灸诊所。以"We嘩蓝屋"活化时，建筑和原来的住户都留了下来。2017年，它获得联合国教科文组织亚太区文化遗产保护卓越奖。',
        },
        zhHK: {
          title: '藍屋建築群：屋同人一齊留低',
          text: '離利東街只係幾分鐘路嘅石水渠街，俾咗一個完全唔同嘅答案：藍屋建築群，一組1920年代至1950年代嘅唐樓。留意吓四層高嘅磚砌唐樓、木樓梯，同埋有裝飾鐵欄嘅懸臂式露台。呢度以前係華佗醫院，可能係灣仔第一間華人醫療機構，之後做過華佗廟、武館同針灸診所。以「We嘩藍屋」活化嗰陣，建築同原本嘅住戶都留低咗。2017年，佢攞咗聯合國教科文組織亞太區文化遺產保護卓越獎。',
        },
      }),
    },
  },

  // ───────────── 5. Happy Valley / Race Course Fire Memorial ─────────────
  // Fatal fire: calm, factual, respectful.
  'happy-valley-racecourse': {
    'architecture-history': {
      short: themed({
        placeId: 'happy-valley-racecourse', theme: 'architecture-history', length: 'short',
        sourceUrls: [SRC.amoFireMemorial],
        en: { title: 'The Race Course Fire Memorial', text: 'Near Happy Valley stands a 1922 memorial to the more than six hundred people who died in the racecourse fire of 1918. It blends Chinese and Western design.' },
        zhCN: { title: '马场火灾纪念碑', text: '跑马地附近有一座1922年落成的纪念碑，纪念在1918年马场大火中罹难的六百多人。它融合了中西建筑元素。' },
        zhHK: { title: '馬場火災紀念碑', text: '跑馬地附近有一座1922年落成嘅紀念碑，紀念喺1918年馬場大火入面罹難嘅六百幾人。佢融合咗中西建築元素。' },
      }),
      medium: themed({
        placeId: 'happy-valley-racecourse', theme: 'architecture-history', length: 'medium',
        sourceUrls: [SRC.amoFireMemorial, SRC.twghsFireMemorial],
        en: {
          title: 'Happy Valley: A Memorial Built by the Public',
          text: 'We are approaching Happy Valley, the last stop on our route. On the twenty sixth of February 1918, during the Derby Day races, temporary bamboo stands collapsed and caught fire. More than six hundred people lost their lives, and Tung Wah Hospital led the relief work. In 1922, a memorial paid for by public donations was built at So Kon Po, above today\'s Hong Kong Stadium. It blends Chinese and Western design, with green-tiled roofs beside classical granite niches. It was declared a monument in 2015. Some things a city keeps not as buildings to reuse, but as a place to remember.',
        },
        zhCN: {
          title: '跑马地：由市民捐建的纪念碑',
          text: '我们正接近路线的最后一站，跑马地。1918年2月26日，打吡日赛马期间，临时搭建的竹棚看台倒塌并起火，六百多人不幸罹难，东华医院随即展开救援工作。1922年，一座由公众捐款兴建的纪念碑在扫杆埔落成，位于今日香港大球场上方。它融合中西设计，绿色琉璃瓦屋顶旁是古典式花岗岩壁龛。2015年，它被列为法定古迹。有些东西，城市留下它，不是为了再利用，而是为了记住。',
        },
        zhHK: {
          title: '跑馬地：由市民捐建嘅紀念碑',
          text: '我哋就嚟到路線嘅最後一站，跑馬地。1918年2月26日，打吡日賽馬期間，臨時搭建嘅竹棚看台倒塌起火，六百幾人不幸罹難，東華醫院隨即展開救援工作。1922年，一座由公眾捐款興建嘅紀念碑喺掃桿埔落成，位於今日香港大球場上面。佢融合中西設計，綠色琉璃瓦屋頂隔籬係古典式花崗岩壁龕。2015年，佢被列為法定古蹟。有啲嘢，城市留低佢，唔係為咗再用，而係為咗記住。',
        },
      }),
    },
  },
};

const THEMED_LENGTHS = ['short', 'medium'];

// Picks the theme that matches the user's interest keys (normalised), or null.
export function pickTheme(interestKeys = []) {
  return Object.entries(THEMES).find(([, t]) => interestKeys.some((k) => t.interests.includes(k)))?.[0] || null;
}

// Longest themed script that fits the remaining ride time; shortest if none fits.
export function getThemedStory({ placeId, theme, language = 'en', remainingTimeSec = 45 }) {
  const byLength = themedStories[placeId]?.[theme];
  if (!byLength) return null;
  const options = THEMED_LENGTHS.filter((l) => byLength[l]).map((l) => {
    const s = byLength[l];
    const entry = s.localized[language] || s.localized.en;
    return { ...s, ...entry, language, themeLabel: THEMES[theme].label[language] || THEMES[theme].label.en };
  });
  const fitting = [...options].reverse().find((s) => s.durationSec <= remainingTimeSec);
  return fitting || options[0];
}
