// One-sentence interest lead-ins, prepended to a reviewed script (Student C).
// Each line restates a fact already in that place's sourced scripts — no new facts.
// Current onboarding interests match options.js. Legacy keys remain supported so older
// local profiles and reviewed demo scripts continue to work during the migration.

export const INTEREST_KEYS = {
  Architecture: 'architecture',
  Culture: 'culture',
  Food: 'food',
  Nature: 'nature',
  'Local Life': 'local-life',
  "People's Memories": 'people-memories',
  'Official History': 'official-history',
};

// Which track each interest leans towards (used for a recommendation, never forced).
export const INTEREST_TRACK = {
  architecture: 'official',
  culture: 'culture',
  food: 'culture',
  nature: 'official',
  'official-history': 'official',
  'local-life': 'civilian',
  'people-memories': 'civilian',
};

export const interestHooks = {
  'central-market': {
    architecture: {
      en: 'Architecture focus: look for the long horizontal lines of its 1939 Streamline Moderne facade.',
      'zh-CN': '建筑视角：留意1939年流线型现代主义外墙上修长的水平线条。',
      'zh-HK': '建築角度：留意吓1939年流線型現代主義外牆嘅修長橫線條。',
    },
    'local-life': {
      en: 'Everyday life focus: this building worked as a market until March 2003.',
      'zh-CN': '生活视角：这座建筑一直作为街市运作，直到2003年3月。',
      'zh-HK': '生活角度：呢座建築一直做街市，做到2003年3月。',
    },
    'people-memories': {
      en: 'People\'s memories: when it reopened, only thirteen of more than two hundred stalls were kept.',
      'zh-CN': '人的记忆：重开时，两百多个档位只保留了十三个。',
      'zh-HK': '人嘅記憶：重開嗰陣，兩百幾個檔位只保留咗十三個。',
    },
    'official-history': {
      en: 'History focus: this is the fourth market built here, and trading in this area dates back to 1842.',
      'zh-CN': '历史视角：这是这里的第四代街市，这一带早在1842年已有市场。',
      'zh-HK': '歷史角度：呢度係第四代街市，呢一帶早喺1842年已經有市場。',
    },
  },
  'court-of-final-appeal': {
    architecture: {
      en: 'Architecture focus: note the tall Ionic columns and granite walls, standing on hundreds of Chinese fir piles.',
      'zh-CN': '建筑视角：留意高大的爱奥尼式柱和花岗岩外墙，整座建筑立在数百根杉木桩上。',
      'zh-HK': '建築角度：留意吓高大嘅愛奧尼式柱同花崗岩外牆，成座建築企喺幾百條杉木樁上面。',
    },
    'local-life': {
      en: 'Everyday life focus: on Sundays, the square beside this court becomes a gathering place for domestic workers.',
      'zh-CN': '生活视角：每逢星期日，法院旁的广场成为家务助理的聚会地点。',
      'zh-HK': '生活角度：每逢星期日，法院隔籬嘅廣場就變成家務助理嘅聚腳點。',
    },
    'people-memories': {
      en: 'People\'s memories: since the 1980s, thousands of domestic workers have spent their Sundays here.',
      'zh-CN': '人的记忆：从1980年代起，数以千计的家务助理在这里度过星期日。',
      'zh-HK': '人嘅記憶：由1980年代開始，幾千個家務助理喺呢度過星期日。',
    },
    'official-history': {
      en: 'History focus: one building, three institutions: the Supreme Court from 1912, the Legislative Council from 1985, and the Court of Final Appeal since 2015.',
      'zh-CN': '历史视角：一座建筑，三个机构：1912年起是最高法院，1985年起是立法会，2015年起是终审法院。',
      'zh-HK': '歷史角度：一座建築，三個機構：1912年起係最高法院，1985年起係立法會，2015年起係終審法院。',
    },
  },
  'lee-tung-street': {
    architecture: {
      en: 'Architecture focus: three pre-war tenement houses on Queen\'s Road East were kept inside the new development.',
      'zh-CN': '建筑视角：新发展项目里保留了皇后大道东上三幢战前唐楼。',
      'zh-HK': '建築角度：新發展項目入面保留咗皇后大道東三幢戰前唐樓。',
    },
    'local-life': {
      en: 'Everyday life focus: for decades, people from all over Hong Kong came here to order their wedding cards.',
      'zh-CN': '生活视角：几十年来，全港各地的人都来这里订造喜帖。',
      'zh-HK': '生活角度：幾十年嚟，全港各區嘅人都嚟呢度訂喜帖。',
    },
    'people-memories': {
      en: 'People\'s memories: residents and shop owners formed the H15 Concern Group to campaign against the redevelopment plan.',
      'zh-CN': '人的记忆：居民和店主曾组成H15关注组，反对重建计划。',
      'zh-HK': '人嘅記憶：居民同舖主曾經組成H15關注組，反對重建計劃。',
    },
    'official-history': {
      en: 'History focus: the Urban Renewal Authority announced the redevelopment in 2003, and the new street opened in 2015.',
      'zh-CN': '历史视角：市区重建局在2003年宣布重建，新街道于2015年开放。',
      'zh-HK': '歷史角度：市區重建局喺2003年宣佈重建，新街道喺2015年開放。',
    },
  },
  'blue-house': {
    architecture: {
      en: 'Architecture focus: look for the cantilevered balconies with ornamental ironwork, and the timber stairs.',
      'zh-CN': '建筑视角：留意带装饰铁栏的悬臂式露台和木楼梯。',
      'zh-HK': '建築角度：留意吓有裝飾鐵欄嘅懸臂式露台同木樓梯。',
    },
    'local-life': {
      en: 'Everyday life focus: families on each floor once shared a single kitchen.',
      'zh-CN': '生活视角：以前每层的住户共用一个厨房。',
      'zh-HK': '生活角度：以前每層嘅住戶共用一個廚房。',
    },
    'people-memories': {
      en: 'People\'s memories: when the buildings were revitalised, the old residents were allowed to stay.',
      'zh-CN': '人的记忆：建筑活化时，原来的居民得以留下。',
      'zh-HK': '人嘅記憶：建築活化嗰陣，原本嘅居民可以留低。',
    },
    'official-history': {
      en: 'History focus: the site once held Wah To Hospital, possibly the first Chinese medical facility in Wan Chai.',
      'zh-CN': '历史视角：这里曾是华佗医院，可能是湾仔第一所华人医疗机构。',
      'zh-HK': '歷史角度：呢度以前係華佗醫院，可能係灣仔第一間華人醫療機構。',
    },
  },
  // Fatal fire: keep every lead-in calm and factual.
  'happy-valley-racecourse': {
    architecture: {
      en: 'Architecture focus: the 1922 memorial blends Chinese and Western design, from green-tiled roofs to classical granite niches.',
      'zh-CN': '建筑视角：1922年的纪念碑融合中西设计，有绿色琉璃瓦屋顶，也有古典式花岗岩壁龛。',
      'zh-HK': '建築角度：1922年嘅紀念碑融合中西設計，有綠色琉璃瓦屋頂，亦有古典式花崗岩壁龕。',
    },
    'local-life': {
      en: 'Everyday life focus: in 1918, more than ten thousand people came to watch the Lunar New Year races.',
      'zh-CN': '生活视角：1918年，一万多人前来观看农历新年赛马。',
      'zh-HK': '生活角度：1918年，一萬幾人嚟睇農曆新年賽馬。',
    },
    'people-memories': {
      en: 'People\'s memories: the memorial\'s plaques name the victims in Chinese and English.',
      'zh-CN': '人的记忆：纪念碑的碑文以中英文记下了罹难者的名字。',
      'zh-HK': '人嘅記憶：紀念碑嘅碑文用中英文記低咗罹難者嘅名字。',
    },
    'official-history': {
      en: 'History focus: it is the first and only communal grave in Hong Kong built with public donations for disaster victims.',
      'zh-CN': '历史视角：这是香港首个也是唯一一个以公众捐款为灾难罹难者兴建的公墓。',
      'zh-HK': '歷史角度：呢度係香港第一個亦係唯一一個用公眾捐款為災難罹難者建成嘅公墓。',
    },
  },
};
