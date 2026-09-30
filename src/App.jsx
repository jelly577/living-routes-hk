import { useEffect, useMemo, useRef, useState } from 'react';
import { mockPosts } from './data/mockPosts.js';
import { identityOptions, interestOptions } from './data/options.js';
import { addPost, analyzeInterestProfile, createNarrator, generateJourneyLog, getMyPosts, getPosts, getRoute, getStoryForJourney, processVoiceSubmission } from './services/index.js';
import MapView from './MapView.jsx';

const ethicsCommitments = [
  {
    title: 'Consent',
    chinese: '知情同意',
    text: 'Contributors are told how their story, voice and images may be used before anything is published.',
  },
  {
    title: 'Attribution',
    chinese: '署名选择',
    text: 'Contributors choose to be named, credited with a pseudonym or remain anonymous.',
  },
  {
    title: 'Correction rights',
    chinese: '纠错与撤回',
    text: 'Contributors can request corrections or withdraw their material from future use.',
  },
  {
    title: 'Fair benefit sharing',
    chinese: '合理分享收益',
    text: 'Any institutional or commercial use should agree fair benefits with contributors and partner communities.',
  },
];

function EthicsConsent({ onAccept }) {
  const [signedName, setSignedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const canContinue = signedName.trim().length > 1 && agreed;

  const submit = (event) => {
    event.preventDefault();
    if (!canContinue) return;
    onAccept({
      signedName: signedName.trim(),
      acceptedAt: new Date().toISOString(),
      version: 'community-ethics-v1',
    });
  };

  return <main className="ethics-screen page-enter">
    <header className="ethics-hero">
      <span className="eyebrow">LIVING ROUTES HK · COMMUNITY ETHICS</span>
      <h1>Stories belong<br/>to <em>people.</em></h1>
      <p>Before entering, please acknowledge how Living Routes HK protects community stories while using AI.</p>
    </header>

    <section className="ethics-list" aria-label="Our community commitments">
      {ethicsCommitments.map((item, index) => <article key={item.title}>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div><h2>{item.title} <small>{item.chinese}</small></h2><p>{item.text}</p></div>
      </article>)}
    </section>

    <aside className="ai-boundary">
      <b>AI supports — people decide.</b>
      <p>Verified history, community memory and AI-assisted interpretation remain clearly labelled. AI may transcribe, translate and adapt approved material, but publication still requires human review.</p>
    </aside>

    <form className="ethics-signature" onSubmit={submit}>
      <span className="eyebrow">CONSENT ACKNOWLEDGEMENT</span>
      <label>Name / Signature
        <input type="text" value={signedName} onChange={(event) => setSignedName(event.target.value)} placeholder="Enter your name" autoComplete="name" required/>
      </label>
      <label className="ethics-check">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} required/>
        <span>I have read, understand and agree to these community commitments.</span>
      </label>
      <button className="primary wide" disabled={!canContinue}>Acknowledge &amp; Continue <span>→</span></button>
      <p className="ethics-note">Prototype acknowledgement only · kept in this browser session · story contributors still approve each submission separately.</p>
    </form>
  </main>;
}

function Onboarding({ onFinish }) {
  const [identity, setIdentity] = useState('visitor');
  const [interests, setInterests] = useState(['Architecture', 'Culture']);
  const selectedIdentity = identityOptions.find((item) => item.value === identity);

  const toggle = (value) => setInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  return <main className="onboarding page-enter">
    <div className="hero-photo" />
    <div className="onboarding-content">
      <span className="eyebrow">LIVING ROUTES HK · 城市声线</span>
      <h1>Discover Your<br/><em>Hong Kong</em></h1>
      <p className="intro">Tell us what moves you. We will shape the city’s stories around your journey.</p>

      <section className="quiz-card">
        <div className="question-number">01</div>
        <h2>Who are you?</h2>
        <div className="chips single">
          {identityOptions.map((item) => <button key={item.value} className={identity === item.value ? 'chip active' : 'chip'} onClick={() => setIdentity(item.value)}>{item.label}</button>)}
        </div>
        <p className="choice-note">{selectedIdentity?.description}</p>
      </section>

      <section className="quiz-card">
        <div className="question-number">02</div>
        <h2>What are you interested in?</h2>
        <div className="chips">
          {interestOptions.map((item) => <button key={item} className={interests.includes(item) ? 'chip active' : 'chip'} onClick={() => toggle(item)}>{item}</button>)}
        </div>
      </section>

      <button className="primary wide" onClick={() => onFinish({ identity, interests })}>Start Journey <span>→</span></button>
      <p className="privacy-note">Your interests stay on this device for this prototype.</p>
    </div>
  </main>;
}

function BottomNav({ active, setActive }) {
  const tabs = [
    ['map', '⌖', 'Map'],
    ['community', '◫', 'Community'],
    ['journal', '▤', 'Private Journal'],
  ];
  return <nav className="bottom-nav">
    {tabs.map(([id, icon, label]) => <button key={id} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(id)}>
      <span className="nav-icon">{icon}</span><span>{label}</span>
    </button>)}
  </nav>;
}

function PlayerSheet({ onClose, profile, placeId, remainingTimeSec }) {
  const [mode, setMode] = useState('official');
  const [language, setLanguage] = useState('en');
  const [progress, setProgress] = useState(0);
  const [storyResult, setStoryResult] = useState(null);
  const [trackNotice, setTrackNotice] = useState('');
  const [audioState, setAudioState] = useState({ state: 'idle', mode: null });
  const [collapsed, setCollapsed] = useState(true); // 默认紧凑细条，不遮地图蓝点/pin
  const narrator = useMemo(() => createNarrator({
    onStateChange: setAudioState,
    onProgress: (value) => setProgress(Math.round(value * 100)),
  }), []);
  const lastAutoPlayedRef = useRef(null);

  useEffect(() => () => narrator.stop(), [narrator]);

  const changeMode = (nextMode) => {
    if (nextMode === mode) return;
    narrator.stop();
    setProgress(0);
    const labels = { official: 'Heritage Facts', civilian: 'Local Voices', culture: 'Culture Bites' };
    setTrackNotice(`Switched to ${labels[nextMode]} · press play when ready`);
    setMode(nextMode);
  };

  const changeLanguage = (nextLanguage) => {
    if (nextLanguage === language) return;
    narrator.stop();
    setProgress(0);
    setTrackNotice('Language changed · press play when ready');
    setLanguage(nextLanguage);
  };

  useEffect(() => {
    let cancelled = false;
    getStoryForJourney({
      placeId: placeId || 'central-market',
      track: mode,
      remainingTimeSec: remainingTimeSec || 45,
      interests: profile?.interests || [],
      interestProfile: profile?.interestProfile,
      audience: profile?.identity || 'visitor',
      language,
    }).then((result) => {
      if (!cancelled) setStoryResult(result);
    });
    return () => { cancelled = true; };
  }, [mode, profile, language, placeId, remainingTimeSec]);

  // 到达新站点时自动连播（切换语言/主题时 placeId 未变，不会重复播放）
  useEffect(() => {
    const storyPlaceId = storyResult?.story?.placeId;
    if (!storyPlaceId || storyPlaceId === lastAutoPlayedRef.current) return;
    lastAutoPlayedRef.current = storyPlaceId;
    narrator.play(storyResult.story, language);
  }, [storyResult, language, narrator]);

  const togglePlayback = () => {
    if (!storyResult?.story) return;
    if (audioState.state === 'playing') narrator.pause();
    else if (audioState.state === 'paused') narrator.resume();
    else narrator.play(storyResult.story, language);
  };

  const stateLabel = audioState.state === 'loading'
    ? 'Loading audio…'
    : audioState.state === 'text-only'
      ? 'Audio unavailable · reading text'
      : trackNotice || (audioState.state === 'ended' ? 'Story ended' : 'Approaching Central Market');

  const toggleCollapse = () => setCollapsed((c) => !c);

  return <div className={`player-sheet ${mode} ${collapsed ? 'collapsed' : ''}`}>
    {collapsed ? (
      <div className="player-mini-row">
        <button className="play mini" onClick={togglePlayback} disabled={!storyResult}>{audioState.state === 'playing' ? 'Ⅱ' : '▶'}</button>
        <div className="player-mini-title" onClick={toggleCollapse}>
          <b>{storyResult?.story.title || '讲解已就绪'}</b>
          <small>{stateLabel}</small>
        </div>
        <button className="mini-icon" onClick={toggleCollapse} title="展开讲解">⌃</button>
        <button className="mini-icon" onClick={onClose} title="关闭">×</button>
      </div>
    ) : (
      <>
        <div className="player-head" onClick={toggleCollapse}>
          <div className="sheet-handle" />
          <span className="eyebrow">CITYBUS 1 · CENTRAL → HAPPY VALLEY</span>
          <h2>{storyResult?.story.title || 'Loading story…'}</h2>
        </div>
        <button className="sheet-collapse" onClick={toggleCollapse} title="收起讲解">⌄</button>
        <button className="close" onClick={onClose}>×</button>
        <div className="mode-toggle">
          <button className={mode === 'official' ? 'active' : ''} onClick={() => changeMode('official')}>Heritage Facts</button>
          <button className={mode === 'civilian' ? 'active' : ''} onClick={() => changeMode('civilian')}>Local Voices</button>
          <button className={mode === 'culture' ? 'active' : ''} onClick={() => changeMode('culture')}>Culture Bites</button>
        </div>
        <div className="language-toggle"><button className={language === 'en' ? 'active' : ''} onClick={() => changeLanguage('en')}>English</button><button className={language === 'zh-HK' ? 'active' : ''} onClick={() => changeLanguage('zh-HK')}>Cantonese 粤语</button><button className={language === 'zh-CN' ? 'active' : ''} onClick={() => changeLanguage('zh-CN')}>Mandarin 普通话</button></div>
        <div className="source-line">{mode === 'official' ? '✓ Source-grounded · official source attached' : `✦ ${storyResult?.story.disclosure || (mode === 'culture' ? 'Curated from public sources' : 'Demo civilian sample · not a verified resident submission')}`}</div>
        {storyResult?.story.sourceUrls?.length > 0 && <div className="source-links">{storyResult.story.sourceUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>Source {index + 1}</a>)}</div>}
        <p className="story-preview">{storyResult?.story.text || 'Loading story text…'}</p>
        <div className="player-row">
          <button className="play" onClick={togglePlayback} disabled={!storyResult}>{audioState.state === 'playing' ? 'Ⅱ' : '▶'}</button>
          <div className="progress-wrap"><div className="progress"><span style={{ width: `${progress}%` }} /></div><div className="time"><span>{stateLabel}{audioState.mode ? ` · ${audioState.mode}` : ''}</span><span>{storyResult?.story.durationSec || 30}s story</span></div></div>
        </div>
        <div className="stops"><span className="done">Macao Ferry</span><span className="current">Central Market</span><span>Wan Chai</span><span>Happy Valley</span></div>
      </>
    )}
  </div>;
}

function PlacePostsSheet({ place, onClose, onPostAdded }) {
  const [posts, setPosts] = useState([]);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPosts({ placeId: place.id }).then((result) => { if (!cancelled) setPosts(result); });
    return () => { cancelled = true; };
  }, [place.id]);

  const submitPost = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('photo');
    const created = await addPost({
      photo: file?.size ? URL.createObjectURL(file) : undefined,
      text: form.get('memory'),
      location: place.id,
      role: 'tourist',
      consent: form.get('consent') === 'on',
    });
    setPosts((current) => [created, ...current]);
    setComposing(false);
    event.currentTarget.reset();
    onPostAdded?.();
  };

  return <div className="place-posts-sheet page-enter">
    <div className="sheet-handle" />
    <button className="close" onClick={onClose}>×</button>
    {place.image?.url && <div className="place-hero"><img src={place.image.url} alt={place.image.alt || place.nameZh} />{place.image.credit && <small>© {place.image.credit}</small>}</div>}
    <span className="eyebrow">COMMUNITY MEMORY · 社区记忆</span>
    <h2>{place.nameZh} <small>{place.nameEn}</small></h2>
    {posts.length === 0 ? (
      <p className="posts-empty">这里还没有社区投稿，成为第一个留下脚印的人。</p>
    ) : (
      <div className="place-posts-list">
        {posts.map((post) => <article className="post-card" key={post.id}><div className="post-copy"><small>⌖ {post.place}</small><p>{post.text}</p><b>{post.author}</b></div></article>)}
      </div>
    )}
    {composing ? (
      <form className="compose-inline" onSubmit={submitPost}>
        <label className="inline-label">你的社区记忆
          <textarea name="memory" required placeholder="这个地方对你意味着什么？" />
        </label>
        <label className="upload">＋ Add a photo <input type="file" name="photo" accept="image/*" /></label>
        <label className="consent-row"><input type="checkbox" name="consent" /> Allow this post to be considered for AI curation</label>
        <div className="inline-actions">
          <button type="button" className="secondary" onClick={() => setComposing(false)}>取消</button>
          <button className="primary" type="submit">投稿</button>
        </div>
      </form>
    ) : (
      <button className="primary wide" onClick={() => setComposing(true)}>＋ Post here</button>
    )}
  </div>;
}

function DemoNarration({ segment, profile }) {
  const placeId = segment?.to?.id;
  const distanceM = segment ? Math.max(1, Math.round(segment.to.progress - segment.from.progress)) : 0;
  const fastSec = Math.max(1, Math.round(distanceM / (45 / 3.6)));   // 左：快 + 建筑
  const slowSec = Math.max(1, Math.round(distanceM / (10 / 3.6)));   // 右：慢 + 美食
  const normalSec = Math.max(1, Math.round(distanceM / (30 / 3.6))); // 试乘实际车速，用于中文单条讲解
  const [language, setLanguage] = useState('en');
  const [collapsed, setCollapsed] = useState(false);
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [single, setSingle] = useState(null); // 普通话/粤语：单条讲解（无对比）
  const [playing, setPlaying] = useState(null); // 'left' | 'right' | 'single' | null

  const archProfile = useMemo(() => ({ architecture: 1, culture: 0, food: 0, nature: 0 }), []);
  const foodProfile = useMemo(() => ({ architecture: 0, culture: 0, food: 1, nature: 0 }), []);

  const narrator = useMemo(() => createNarrator({
    onStateChange: (s) => { if (s.state === 'ended' || s.state === 'idle') setPlaying(null); },
  }), []);
  useEffect(() => () => narrator.stop(), [narrator]);

  // 切语言先停掉旧播报，避免和新内容重叠
  useEffect(() => { narrator.stop(); setPlaying(null); }, [language, narrator]);

  // 按语言取内容：英语=左右对比；普通话/粤语=单条（用 C 的译文）
  useEffect(() => {
    if (!placeId || !distanceM) { setLeft(null); setRight(null); setSingle(null); return; }
    let cancelled = false;
    if (language === 'en') {
      const common = { placeId, track: 'official', audience: 'visitor', language: 'en', maxHooks: 1 };
      Promise.all([
        getStoryForJourney({ ...common, remainingTimeSec: fastSec, interestProfile: archProfile }),
        getStoryForJourney({ ...common, remainingTimeSec: slowSec, interestProfile: foodProfile }),
      ]).then(([l, r]) => { if (!cancelled) { setLeft({ ...l, sec: fastSec }); setRight({ ...r, sec: slowSec }); } });
    } else {
      getStoryForJourney({
        placeId,
        track: 'official',
        remainingTimeSec: normalSec,
        interests: profile?.interests || [],
        interestProfile: profile?.interestProfile,
        audience: profile?.identity || 'visitor',
        language,
      }).then((s) => { if (!cancelled) setSingle({ ...s, sec: fastSec }); });
    }
    return () => { cancelled = true; };
  }, [placeId, distanceM, fastSec, language, archProfile, foodProfile, profile]);

  // 试乘：每到新站自动播（英语播左列快+建筑；中文播单条）
  const autoPlayedRef = useRef(null);
  useEffect(() => {
    const story = language === 'en' ? left?.story : single?.story;
    if (!story) return;
    const key = `${story.placeId}.${language}`;
    if (autoPlayedRef.current === key) return;
    autoPlayedRef.current = key;
    narrator.play(story, language);
    setPlaying(language === 'en' ? 'left' : 'single');
  }, [left, single, language, narrator]);

  if (!placeId) return null;

  const activeStory = language === 'en' ? left?.story : single?.story;
  const activeSide = language === 'en' ? 'left' : 'single';

  const playSide = (side, result) => {
    if (!result?.story) return;
    if (playing === side) { narrator.stop(); setPlaying(null); return; }
    narrator.play(result.story, language);
    setPlaying(side);
  };

  const togglePlay = () => {
    if (!activeStory) return;
    if (playing) { narrator.stop(); setPlaying(null); return; }
    narrator.play(activeStory, language);
    setPlaying(activeSide);
  };

  const toggleCollapse = () => setCollapsed((c) => !c);

  const renderCol = (result, side, tone) => (
    <div className={`compare-col ${tone}`}>
      <div className="compare-col-head">
        <b>{side === 'left' ? '🚀 Fast · 45 km/h' : '🐢 Slow · 10 km/h'}</b>
        <span className="compare-persona">{side === 'left' ? '👤 Architecture lover' : '👤 Food lover'}</span>
      </div>
      <div className="compare-metrics">
        <span>{distanceM} m · {result ? `${result.sec}s to next stop` : '…'}</span>
        <em>{result ? `${(result.story?.length || '').toUpperCase()} · ${result.story?.durationSec ?? '…'}s audio` : '…'}</em>
      </div>
      {result?.story?.hookText && <div className={`compare-hook ${tone}`}><small>🎯 INTEREST-INJECTED</small>{result.story.hookText}</div>}
      <p className="compare-base">{result?.story?.baseText || 'Preparing…'}</p>
      <button className={`compare-play ${playing === side ? 'is-on' : ''}`} onClick={() => playSide(side, result)} disabled={!result}>
        {playing === side ? 'Ⅱ Stop' : '▶ Listen'}
      </button>
    </div>
  );

  if (collapsed) {
    return <div className="speed-compare page-enter collapsed" onClick={toggleCollapse}>
      <div className="player-mini-row">
        <button className="play mini" onClick={(e) => { e.stopPropagation(); togglePlay(); }} disabled={!activeStory}>{playing ? 'Ⅱ' : '▶'}</button>
        <div className="player-mini-title">
          <b>{segment.to.nameZh} · {segment.to.nameEn}</b>
          <small>{language === 'en' ? 'English · Speed comparison' : language === 'zh-HK' ? 'Cantonese 粤语' : 'Mandarin 普通话'}</small>
        </div>
        <button className="mini-icon" title="展开" onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}>⌃</button>
      </div>
    </div>;
  }

  return <div className="speed-compare page-enter">
    <div className="sheet-handle" />
    <button className="sheet-collapse" onClick={toggleCollapse} title="收起讲解">⌄</button>
    <div className="language-toggle">
      <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>
      <button className={language === 'zh-HK' ? 'active' : ''} onClick={() => setLanguage('zh-HK')}>Cantonese 粤语</button>
      <button className={language === 'zh-CN' ? 'active' : ''} onClick={() => setLanguage('zh-CN')}>Mandarin 普通话</button>
    </div>
    <span className="eyebrow">AI ADAPTATION · approaching {segment.to.nameZh} ({segment.to.nameEn})</span>
    {language === 'en' ? (
      <div className="compare-cols">
        {renderCol(left, 'left', 'fast')}
        {renderCol(right, 'right', 'slow')}
      </div>
    ) : (
      <div className="compare-single">
        <p className="compare-base">{single?.story?.text || '正在加载讲解…'}</p>
        <button className={`compare-play ${playing === 'single' ? 'is-on' : ''}`} onClick={() => playSide('single', single)} disabled={!single}>
          {playing === 'single' ? 'Ⅱ 停止' : '▶ 播放'}
        </button>
      </div>
    )}
    {language === 'en' && <p className="compare-note">Same stop, two riders: speed sets the length, interest shapes the detail.</p>}
  </div>;
}

function MapScreen({ profile, onPostAdded }) {
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentPlaceId, setCurrentPlaceId] = useState(null);
  const [timeToNextSec, setTimeToNextSec] = useState(null);
  const [chromeCollapsed, setChromeCollapsed] = useState(false);
  const [postsPlace, setPostsPlace] = useState(null);
  const [mode, setMode] = useState('bus');
  const [nearbyPlace, setNearbyPlace] = useState(null);
  const [segment, setSegment] = useState(null);
  const [demoing, setDemoing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRoute({ mode: 'demo' }).then((nextRoute) => { if (!cancelled) setRoute(nextRoute); });
    return () => { cancelled = true; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    const requestedDestination = destination.trim() || 'Happy Valley';
    setDestination(requestedDestination);
    setLoading(true);
    const nextRoute = await getRoute({ destination: requestedDestination, mode: 'demo' });
    setRoute(nextRoute);
    setLoading(false);
    setSearched(true);
  };

  const handleArrive = (place, nextSec) => {
    if (!place?.id) return;
    if (demoing) return; // 试乘：由速度对比卡连播，不再打开讲解弹窗
    setCurrentPlaceId(place.id);
    setTimeToNextSec(nextSec ?? null);
    setPlayerOpen(true);
  };

  // 试乘开始即收起讲解弹窗，避免与速度对比卡同时播报
  useEffect(() => { if (demoing) setPlayerOpen(false); }, [demoing]);

  return <section className={`screen map-screen page-enter ${chromeCollapsed ? 'chrome-collapsed' : ''}`}>
    <div className="map-canvas"><MapView route={route} mode={mode} onArrive={handleArrive} onSelectPlace={setPostsPlace} onSegmentChange={setSegment} onNearbyPlace={setNearbyPlace} onDemoingChange={setDemoing} /></div>
    <div className="mode-switch">
      <button className={mode === 'bus' ? 'active' : ''} onClick={() => setMode('bus')}>Bus Tour</button>
      <button className={mode === 'walk' ? 'active' : ''} onClick={() => setMode('walk')}>Walk &amp; Community</button>
    </div>
    {nearbyPlace && (
      <button className="nearby-toast" onClick={() => setPostsPlace(nearbyPlace)}>
        <b>📍 你已到 {nearbyPlace.nameZh}</b>
        <span>点击查看社区 · {nearbyPlace.nameEn}</span>
      </button>
    )}
    {chromeCollapsed ? (
      <button className="chrome-mini" onClick={() => setChromeCollapsed(false)}>
        <span className="brand-mark chrome-mini-mark">LR</span><b>展开</b>
      </button>
    ) : (
      <>
        <header className="floating-header"><span className="brand-mark">LR</span><div><b>Living Routes</b><small>Hong Kong · 香港</small></div><button className="avatar">JJ</button><button className="chrome-close" onClick={() => setChromeCollapsed(true)} title="收起顶部栏">⌃</button></header>
        <form className="route-search" onSubmit={submit}><span>⌕</span><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Enter destination…"/><button type="submit">Route</button></form>
      </>
    )}
    {loading && <div className="map-hint"><b>Preparing Route 1…</b><span>Plotting your story route.</span></div>}
    {searched && route && !playerOpen && <div className="route-card page-enter">
      <div className="sheet-handle"/><span className="eyebrow">AI STORY TRACK READY · CITYBUS 1</span><h2>{route.origin} → {route.destination}</h2>
      <div className="route-stats"><div><b>{route.estimatedDurationMin} min</b><span>Journey</span></div><div><b>{route.storyPoints.length}</b><span>Heritage points</span></div><div><b>3</b><span>Story types</span></div></div>
      <p>Story length is adapted to your travel time and interests.</p>
      <button className="primary wide" onClick={() => setPlayerOpen(true)}>Begin Route <span>▶</span></button>
    </div>}
    {playerOpen && <PlayerSheet profile={profile} placeId={currentPlaceId} remainingTimeSec={timeToNextSec} onClose={() => setPlayerOpen(false)} />}
    {segment && mode === 'bus' && demoing && <DemoNarration segment={segment} profile={profile} />}
    {postsPlace && <PlacePostsSheet place={postsPlace} onClose={() => setPostsPlace(null)} onPostAdded={onPostAdded} />}
  </section>;
}

function CommunityScreen({ onPostAdded }) {
  const [filter, setFilter] = useState('all');
  const [posts, setPosts] = useState(mockPosts);
  const [composer, setComposer] = useState(false);
  const [voiceDemo, setVoiceDemo] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPosts({ filter }).then((result) => {
      if (!cancelled) setPosts(result);
    });
    return () => { cancelled = true; };
  }, [filter]);

  const submitPost = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('photo');
    const created = await addPost({
      photo: file?.size ? URL.createObjectURL(file) : undefined,
      text: form.get('memory'),
      location: form.get('place'),
      role: 'tourist',
      consent: form.get('consent') === 'on',
    });
    setPosts((current) => [created, ...current]);
    setComposer(false);
    onPostAdded?.();
  };

  const submitVoice = async (event) => {
    event.preventDefault();
    setVoiceLoading(true);
    const form = new FormData(event.currentTarget);
    const file = form.get('voice');
    const result = await processVoiceSubmission({
      audioFile: file?.size ? file : undefined,
      transcript: form.get('voiceTranscript'),
      placeId: form.get('voicePlace'),
      consent: form.get('voiceConsent') === 'on',
    });
    setVoiceResult(result);
    setVoiceLoading(false);
  };

  return <section className="screen community-screen page-enter">
    <header className="section-header"><span className="eyebrow">THE CITY REMEMBERS</span><h1>Community</h1><p>New footsteps meet stories passed down through generations.</p><button className="voice-demo-trigger" onClick={() => { setVoiceDemo(true); setVoiceResult(null); }}>♩ Try voice-note curation demo</button></header>
    <div className="segmented"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All stories</button><button className={filter === 'tourist' ? 'active' : ''} onClick={() => setFilter('tourist')}>Tourist Footprints</button><button className={filter === 'local' ? 'active' : ''} onClick={() => setFilter('local')}>Local Legends</button></div>
    <div className="post-grid">{posts.map((post) => <article className="post-card" key={post.id}><div className={`post-image ${post.image ? '' : 'placeholder'}`}>{post.image ? <img src={post.image} alt={post.place}/> : <div className="post-image-placeholder"><b>{post.place}</b><small>PHOTO NOT PROVIDED</small></div>}<span>{post.era}</span></div><div className="post-copy"><small>⌖ {post.place}</small><p>{post.text}</p><b>{post.author}</b></div></article>)}</div>
    <button className="fab" onClick={() => setComposer(true)}>＋</button>
    {composer && <div className="modal-backdrop"><form className="compose-card" onSubmit={submitPost}><button type="button" className="close" onClick={() => setComposer(false)}>×</button><span className="eyebrow">LEAVE A TRACE</span><h2>Add to the city’s memory</h2><label>Place<input name="place" placeholder="e.g. central-market"/></label><label>Your story<textarea name="memory" required placeholder="What happened here?"/></label><label className="upload">＋ Add a photo <input type="file" name="photo" accept="image/*"/></label><label><input type="checkbox" name="consent"/> Allow this post to be considered for AI curation</label><button className="primary wide">Post to Community</button></form></div>}
    {voiceDemo && <div className="modal-backdrop"><div className="compose-card voice-card"><button type="button" className="close" onClick={() => setVoiceDemo(false)}>×</button>{!voiceResult ? <><span className="eyebrow">VOICE NOTE → STORY</span><h2>Turn a Cantonese voice note into a story</h2><p className="modal-intro">Demo mode: this represents a WhatsApp voice note. The audio stays local; the pipeline shows transcription, story drafting and review routing.</p><form onSubmit={submitVoice}><label>Place<select name="voicePlace" defaultValue="blue-house"><option value="blue-house">Blue House</option><option value="lee-tung-street">Lee Tung Street</option><option value="central-market">Central Market</option></select></label><label className="upload">＋ Add a voice note <input type="file" name="voice" accept="audio/*"/><small>Optional · use the built-in reviewed sample if left empty</small></label><label>Transcript fallback <textarea name="voiceTranscript" placeholder="Optional: paste a Cantonese transcript for the demo."/></label><label className="consent-row"><input type="checkbox" name="voiceConsent"/> I have permission for AI curation</label><button className="primary wide" disabled={voiceLoading}>{voiceLoading ? 'Processing voice note…' : 'Run curation pipeline →'}</button></form></> : <VoiceResult result={voiceResult} onReset={() => setVoiceResult(null)} />}</div></div>}
  </section>;
}

function VoiceResult({ result, onReset }) {
  const draft = result.generatedStory.languages;
  const [language, setLanguage] = useState('zh-HK');
  const languageLabels = { 'zh-HK': '粵語', 'zh-CN': '普通話', en: 'English' };
  return <div className="voice-result page-enter">
    <span className="eyebrow">PIPELINE COMPLETE · DEMO MODE</span>
    <h2>{draft['zh-HK'].title}</h2>
    <div className="pipeline-steps"><span>✓ Transcribe</span><span>✓ Structure</span><span>✓ Draft 3 languages</span><span>! Human review</span></div>
    <div className="result-block"><small>TRANSCRIPT · {result.transcription.language} · {result.transcription.method === 'user-provided-transcript' ? 'USER PROVIDED' : 'DEMO FALLBACK'}</small><p>{result.transcription.text}</p><b>{Math.round(result.transcription.confidence * 100)}% confidence · {result.input.fileName}</b></div>
    {result.input.voicePreviewUrl && <div className="voice-recording"><small>ORIGINAL VOICE NOTE · PLAYBACK</small><audio controls src={result.input.voicePreviewUrl} /></div>}
    <div className="result-block"><small>EXTRACTED SIGNALS</small><p>{result.extraction.themes.join(' · ')}</p><b>{result.extraction.factCheckNote}</b></div>
    <div className="language-preview">{Object.entries(languageLabels).map(([code, label]) => <button key={code} className={language === code ? 'active' : ''} onClick={() => setLanguage(code)}>{label}</button>)}<p><b>{draft[language].title}</b><br/>{draft[language].text}</p></div>
    <div className="review-callout"><b>Next: {result.moderation.route}</b><span>{result.moderation.reason}</span></div>
    <button className="secondary wide" onClick={onReset}>Process another sample</button>
  </div>;
}

function JournalScreen() {
  const [memories, setMemories] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);

  const addMemory = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('photo');
    setMemories((current) => [...current, { id: Date.now(), place: form.get('place') || 'Central Market', text: form.get('text') || 'A quiet moment between stops.', image: file?.size ? URL.createObjectURL(file) : null }]);
    event.currentTarget.reset();
  };

  const generate = async () => {
    setLoading(true); setGenerated(null);
    const result = await generateJourneyLog({ memories, style: 'reflective', language: 'en' });
    setGenerated(result);
    setLoading(false);
  };

  return <section className="screen journal-screen page-enter">
    <div className="private-banner">▣ <b>Private · Only you can see this</b></div>
    <header className="section-header"><span className="eyebrow">YOUR TIME-WOVEN JOURNEY</span><h1>Private Journal</h1><p>Gather fragments now. Let AI weave them into a story when the journey ends.</p></header>
    <form className="memory-form" onSubmit={addMemory}><label className="upload large">＋<b>Add a journey photo</b><small>Private by default</small><input type="file" name="photo" accept="image/*"/></label><div className="form-row"><input name="place" placeholder="Place"/><textarea name="text" placeholder="What did this moment feel like?"/></div><button className="secondary">Save Memory</button></form>
    {memories.length > 0 && <div className="memory-list">{memories.map((memory, index) => <article key={memory.id}>{memory.image ? <img src={memory.image} alt=""/> : <div className="memory-placeholder">{String(index + 1).padStart(2, '0')}</div>}<div><small>{memory.place}</small><p>{memory.text}</p></div></article>)}</div>}
    <button className="generate-button" onClick={generate} disabled={loading}>✦ {loading ? 'Weaving your memories…' : 'Generate AI Journey Log'}</button>
    {generated && <div className="generated-log page-enter"><span className="eyebrow">GENERATED FROM YOUR ROUTE + MEMORIES</span><h2>{generated.title}</h2>{generated.chapters.map((chapter) => <div className="chapter" key={chapter.id}><i>{String(chapter.order).padStart(2, '0')}</i><div><small>{chapter.place.toUpperCase()} · {chapter.time}</small><h3>{chapter.title}</h3><p>{chapter.text}</p></div></div>)}<div className="profile-update"><small>YOUR PROFILE LEARNED</small><b>{generated.interestSignals.map((signal) => signal.label).join(' · ')}</b><p>Next recommendation: {generated.nextRecommendation.label}</p><span>{generated.nextRecommendation.reason}</span></div><button className="secondary wide">Export Memory Story</button></div>}
  </section>;
}

export default function App() {
  const [ethicsConsent, setEthicsConsent] = useState(null);
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState('map');
  const [myPosts, setMyPosts] = useState([]);

  const refreshMyPosts = async () => { setMyPosts(await getMyPosts()); };

  // 四项兴趣画像：初始所选兴趣给基础权重，社区投稿按关键词加权 → 归一化比例
  const interestProfile = useMemo(
    () => analyzeInterestProfile({ seedInterests: profile?.interests || [], posts: myPosts }),
    [profile?.interests, myPosts],
  );
  const fullProfile = useMemo(
    () => (profile ? { ...profile, interestProfile } : null),
    [profile, interestProfile],
  );

  const content = useMemo(() => ({
    map: <MapScreen profile={fullProfile} onPostAdded={refreshMyPosts} />,
    community: <CommunityScreen onPostAdded={refreshMyPosts} />,
    journal: <JournalScreen />,
  })[active], [active, fullProfile]);

  if (!ethicsConsent) return <EthicsConsent onAccept={setEthicsConsent} />;
  if (!profile) return <Onboarding onFinish={(nextProfile) => setProfile({ ...nextProfile, ethicsConsent })} />;
  return <div className="app-shell">{content}<BottomNav active={active} setActive={setActive}/></div>;
}
