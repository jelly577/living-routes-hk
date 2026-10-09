import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { identityOptions, interestOptions } from './data/options.js';
import { getPlaceById, places } from './data/places.js';
import { shareAllSavedCommunityPosts } from './services/communityService.js';
import { sharedCommunityEnabled } from './services/sharedCommunityService.js';
import { checkpoints as checkpointList } from './data/checkpoints.js';
import { findPostPlace, postLocationGroups } from './data/locations.js';
import { districts, getDistrict, nearestDistrict } from './data/districts.js';
import { addPost, analyzeInterestProfile, createNarrator, deletePost, setPostVisibility, getMyPosts, getPostedPlaces, getPosts, getRoute, getStoryForJourney, processVoiceSubmission } from './services/index.js';
import { applyPhotoStyle } from './services/memoryPostStorage.js';
import MapView from './MapView.jsx';
import MemoirStudio from './memoir/MemoirStudio.jsx';
import DepthClipDemo from './memoir/DepthClipDemo.jsx';
import CommunityPhotoWall from './community/CommunityPhotoWall.jsx';
import PlaceCommunity from './community/PlaceCommunity.jsx';
import TimeMachine from './community/TimeMachine.jsx';
import VoiceSampleRecorder from './community/VoiceSampleRecorder.jsx';
import { isHeritagePlace } from './services/thenNowService.js';
import { searchLocalPlaces, searchOnlinePlaces } from './services/placeSearch.js';
import { isDemoRoute, loadBusData, nameIn as busName, operatorName, routeForMap, routesAtGroup, searchStops } from './services/busService.js';
import { localDay, momentOf } from './services/memoirService.js';
import { UI_LANGUAGES, defaultNarration, getLanguage, placeName, routeTitle, setLanguage as setUiLanguage, t } from './i18n.js';

const ethicsCommitments = ['consent', 'attribution', 'correction', 'benefit'];

// Demo/community posts: show place, text and author in the interface language when a translation exists.
const postPlace = (post) => { if (post.locationType === 'none') return t('loc.none'); const place = findPostPlace(post); return place ? placeName(place) : post.place; };
const postText = (post) => post.textI18n?.[getLanguage()] || post.text;
const postAuthor = (post) => post.authorI18n?.[getLanguage()] || post.author;

function LanguagePicker({ onPick }) {
  return <main className="language-screen page-enter">
    <header>
      <span className="eyebrow">LIVING ROUTES HK · 城市聲線</span>
      <h1 lang="en">Choose your language</h1>
      <p><span lang="zh-HK">選擇語言</span> · <span lang="zh-CN">选择语言</span></p>
    </header>
    <div className="language-options">
      {UI_LANGUAGES.map((option) => <button key={option.code} lang={option.code} onClick={() => onPick(option.code)}>
        <b>{option.label}</b><small>{option.sub}</small><span aria-hidden="true">→</span>
      </button>)}
    </div>
  </main>;
}

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
      <span className="eyebrow">{t('ethics.eyebrow')}</span>
      <h1>{t('ethics.titleA')}<br/>{t('ethics.titleB')} <em>{t('ethics.titleEm')}</em></h1>
      <p>{t('ethics.intro')}</p>
    </header>

    <section className="ethics-list" aria-label={t('ethics.listLabel')}>
      {ethicsCommitments.map((item, index) => <article key={item}>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div><h2>{t(`ethics.${item}.title`)}</h2><p>{t(`ethics.${item}.text`)}</p></div>
      </article>)}
    </section>

    <aside className="ai-boundary">
      <b>{t('ethics.aiTitle')}</b>
      <p>{t('ethics.aiText')}</p>
    </aside>

    <form className="ethics-signature" onSubmit={submit}>
      <span className="eyebrow">{t('ethics.formEyebrow')}</span>
      <label>{t('ethics.nameLabel')}
        <input type="text" value={signedName} onChange={(event) => setSignedName(event.target.value)} placeholder={t('ethics.namePlaceholder')} autoComplete="name" required/>
      </label>
      <label className="ethics-check">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} required/>
        <span>{t('ethics.agree')}</span>
      </label>
      <button className="primary wide" disabled={!canContinue}>{t('ethics.continue')} <span>→</span></button>
      <p className="ethics-note">{t('ethics.note')}</p>
    </form>
  </main>;
}

function Onboarding({ onFinish }) {
  const [identity, setIdentity] = useState('visitor');
  const [interests, setInterests] = useState(['Architecture', 'History']);
  const selectedIdentity = identityOptions.find((item) => item.value === identity);

  const toggle = (value) => setInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  return <main className="onboarding page-enter">
    <div className="hero-photo" />
    <div className="onboarding-content">
      <span className="eyebrow">{t('onb.eyebrow')}</span>
      <h1>{t('onb.titleA')}<br/><em>{t('onb.titleEm')}</em></h1>
      <p className="intro">{t('onb.intro')}</p>

      <section className="quiz-card">
        <div className="question-number">01</div>
        <h2>{t('onb.q1')}</h2>
        <div className="chips single">
          {identityOptions.map((item) => <button key={item.value} className={identity === item.value ? 'chip active' : 'chip'} onClick={() => setIdentity(item.value)}>{t(`identity.${item.value}`)}</button>)}
        </div>
        <p className="choice-note">{selectedIdentity && t(`identity.${selectedIdentity.value}.desc`)}</p>
      </section>

      <section className="quiz-card">
        <div className="question-number">02</div>
        <h2>{t('onb.q2')}</h2>
        <div className="chips">
          {interestOptions.map((item) => <button key={item} className={interests.includes(item) ? 'chip active' : 'chip'} onClick={() => toggle(item)}>{t(`interest.${item}`)}</button>)}
        </div>
        <p className="choice-note">{t('onb.q2note')}</p>
      </section>

      <button className="primary wide" onClick={() => onFinish({ identity, interests })}>{t('onb.start')} <span>→</span></button>
      <p className="privacy-note">{t('onb.privacy')}</p>
    </div>
  </main>;
}

function BottomNav({ active, setActive }) {
  const tabs = [
    ['map', '⌖', t('nav.map')],
    ['community', '◫', t('nav.community')],
    ['journal', '▤', t('nav.journal')],
  ];
  return <nav className="bottom-nav">
    {tabs.map(([id, icon, label]) => <button key={id} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(id)}>
      <span className="nav-icon">{icon}</span><span>{label}</span>
    </button>)}
  </nav>;
}

function PlayerSheet({ onClose, profile, placeId, remainingTimeSec }) {
  // One story per stop: the reviewed, source-grounded script, shaped by the rider's interests.
  const mode = 'official';
  const [language, setLanguage] = useState(defaultNarration);
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

  const changeLanguage = (nextLanguage) => {
    if (nextLanguage === language) return;
    narrator.stop();
    setProgress(0);
    setTrackNotice(t('player.langChanged'));
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
    ? t('player.loadingAudio')
    : audioState.state === 'text-only'
      ? t('player.textOnly')
      : trackNotice || (audioState.state === 'ended' ? t('player.ended') : t('player.approaching', { place: storyResult?.place ? placeName(storyResult.place) : t('player.nextStop') }));

  const toggleCollapse = () => setCollapsed((c) => !c);

  return <div className={`player-sheet ${mode} ${collapsed ? 'collapsed' : ''}`}>
    {collapsed ? (
      <div className="player-mini-row">
        <button className="play mini" onClick={togglePlayback} disabled={!storyResult}>{audioState.state === 'playing' ? 'Ⅱ' : '▶'}</button>
        <div className="player-mini-title" onClick={toggleCollapse}>
          <b>{storyResult?.story.title || t('player.storyReady')}</b>
          <small>{stateLabel}</small>
        </div>
        <div className="mini-lang">
          {[['en', 'EN'], ['zh-HK', '粵'], ['zh-CN', '普']].map(([code, label]) => <button key={code} className={language === code ? 'active' : ''} onClick={() => changeLanguage(code)} aria-label={t(`narr.${code}`)}>{label}</button>)}
        </div>
        <button className="mini-icon" onClick={toggleCollapse} title={t('player.expand')} aria-label={t('player.expand')}>⌃</button>
        <button className="mini-icon" onClick={onClose} title={t('common.close')} aria-label={t('common.close')}>×</button>
      </div>
    ) : (
      <>
        <div className="player-head" onClick={toggleCollapse}>
          <div className="sheet-handle" />
          <span className="eyebrow">{t('player.routeEyebrow')}</span>
          <h2>{storyResult?.story.title || t('player.loadingStory')}</h2>
        </div>
        <button className="sheet-collapse" onClick={toggleCollapse} title={t('player.collapse')} aria-label={t('player.collapse')}>⌄</button>
        <button className="close" onClick={onClose} aria-label={t('common.close')}>×</button>
        {storyResult?.story.themeLabel && <div className="theme-chip">{t('player.forYou', { theme: storyResult.story.themeLabel })}</div>}
        <div className="language-toggle"><button className={language === 'en' ? 'active' : ''} onClick={() => changeLanguage('en')}>{t('narr.en')}</button><button className={language === 'zh-HK' ? 'active' : ''} onClick={() => changeLanguage('zh-HK')}>{t('narr.zh-HK')}</button><button className={language === 'zh-CN' ? 'active' : ''} onClick={() => changeLanguage('zh-CN')}>{t('narr.zh-CN')}</button></div>
        <div className="source-line">{t('player.sourceLine')}{profile?.interests?.length ? t('player.shapedFor', { interests: profile.interests.map((item) => t(`interest.${item}`)).join(' + ') }) : ''}</div>
        {storyResult?.story.sourceUrls?.length > 0 && <div className="source-links">{storyResult.story.sourceUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>{t('player.source', { n: index + 1 })}</a>)}</div>}
        <p className="story-preview">{storyResult?.story.text || t('player.loadingText')}</p>
        <div className="player-row">
          <button className="play" onClick={togglePlayback} disabled={!storyResult}>{audioState.state === 'playing' ? 'Ⅱ' : '▶'}</button>
          <div className="progress-wrap"><div className="progress"><span style={{ width: `${progress}%` }} /></div><div className="time"><span>{stateLabel}</span><span>{t('player.storySec', { n: storyResult?.story.durationSec || 30 })}</span></div></div>
        </div>
        <div className="stops"><span className="done">{t('stops.macao')}</span><span className="current">{t('stops.market')}</span><span>{t('stops.wanchai')}</span><span>{t('stops.hv')}</span></div>
      </>
    )}
  </div>;
}

function PlacePostsSheet({ place, profile, onClose, onPostAdded, initialEra = null }) {
  const [posts, setPosts] = useState([]);
  // Arriving from the community wall's "add a story" opens the form straight away.
  const [composing, setComposing] = useState(Boolean(initialEra));
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState(initialEra === 'ARCHIVAL' ? 'community' : 'private');
  const [photoStyle, setPhotoStyle] = useState('original');
  const [error, setError] = useState('');
  // Every place is a then-and-now comparison: a post is a new story (today) or
  // an old story (how it used to be), and lands in that column of the wall.
  const [storyEra, setStoryEra] = useState(initialEra || 'MODERN');
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [voiceSample, setVoiceSample] = useState(null);
  const [recording, setRecording] = useState(false);
  const isOld = storyEra === 'ARCHIVAL';
  const chooseEra = (era) => {
    setStoryEra(era);
    if (era === 'ARCHIVAL') setVisibility('community'); // old stories are for sharing by default
    else { setVoiceConsent(false); setVoiceSample(null); setRecording(false); }
  };
  // Places picked on the map are not in our data files, so the post carries them.
  const isMapPlace = place.kind === 'user-place';

  useEffect(() => {
    let cancelled = false;
    getPosts({ placeId: place.id }).then((result) => { if (!cancelled) setPosts(result); }).catch((error) => { if (!cancelled) setNotice(error.message); });
    return () => { cancelled = true; };
  }, [place.id]);

  const submitPost = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const file = form.get('photo');
    setSaving(true);
    try {
      const created = await addPost({
        photo: file?.size && photoStyle !== 'none' ? file : undefined,
        text: form.get('memory'),
        ...locationOfMapPlace(place),
        takenAt: form.get('takenDate') || null,
        author: profile?.ethicsConsent?.signedName || t('comm.authorDefault'),
        role: isOld ? 'local' : 'tourist',
        era: storyEra,
        voiceConsent: isOld && voiceConsent,
        voiceSample: isOld ? voiceSample : null,
        consent: form.get('consent') === 'on',
        visibility,
        photoStyle,
      });
      if (created.visibility === 'community' && (place.kind === 'district' ? created.districtId === place.id : created.placeId === place.id)) setPosts((current) => [created, ...current]);
      setNotice(t(created.localSaveFailed ? 'comm.cloudOnly' : created.visibility === 'private' ? 'comm.savedPrivate' : created.shared ? 'comm.postedPending' : 'comm.localOnly'));
      setComposing(false);
      formEl.reset();
      onPostAdded?.(created);
    } catch (err) {
      setError(t('comm.photoNotSaved', { msg: err.message }));
    } finally { setSaving(false); }
  };

  const eyebrow = place.kind === 'checkpoint'
    ? `${t('cp.eyebrow')} · ${t(`cp.cat.${place.category}`)}`
    : isMapPlace ? t('cp.eyebrowUser') : t('posts.eyebrow');

  return <div className="place-posts-sheet page-enter">
    <div className="sheet-handle" />
    <button className="close" onClick={onClose} aria-label={t('common.close')}>×</button>
    {place.image?.url && <div className="place-hero"><img src={place.image.url} alt={placeName(place)} />{place.image.credit && <small>© {place.image.credit}</small>}</div>}
    <span className="eyebrow">{eyebrow}</span>
    <h2>{placeName(place)}</h2>
    {notice && <p role="status">{notice}</p>}
    {place.noteKey && <p className="place-note">{t(place.noteKey)}</p>}
    {posts.length === 0 ? (
      <p className="posts-empty">{t('posts.empty')}</p>
    ) : (
      <div className="place-posts-list">
        {posts.map((post) => <article className="post-card" key={post.id}>{post.image && <div className="post-image"><img className={`photo-style-${post.photoStyle || 'original'}`} src={post.image} alt={postPlace(post)} /></div>}<div className="post-copy"><small>⌖ {postPlace(post)}</small><p>{postText(post)}</p><b>{postAuthor(post)}</b></div></article>)}
      </div>
    )}
    {composing ? (
      <form className="compose-inline" onSubmit={submitPost}>
        <p className="posting-at">⌖ {t('posts.at', { place: placeName(place) })}</p>
        <fieldset className="visibility-picker compact era-picker"><legend>{t('posts.eraLegend')}</legend><div>
          <label><input type="radio" name="storyEra" value="MODERN" checked={!isOld} onChange={() => chooseEra('MODERN')}/><span>{t('posts.eraNew')}<small>{t('posts.eraNewSub')}</small></span></label>
          <label><input type="radio" name="storyEra" value="ARCHIVAL" checked={isOld} onChange={() => chooseEra('ARCHIVAL')}/><span>{t('posts.eraOld')}<small>{t('posts.eraOldSub')}</small></span></label>
        </div></fieldset>
        <label className="inline-label">{isOld ? t('story.text') : t('posts.label')}
          <textarea name="memory" required placeholder={isOld ? t('story.textPh') : t('posts.placeholder')} />
        </label>
        <PhotoUpload photoStyle={photoStyle} />
        <PhotoStylePicker value={photoStyle} onChange={setPhotoStyle} />
        <label className="inline-label">{t('jr.date')}<input type="date" name="takenDate" max={new Date().toISOString().slice(0, 10)}/></label>
        <p className="location-note">{t('posts.dateNote')}</p>
        <fieldset className="visibility-picker compact"><legend>{t('posts.visibility')}</legend><div>
          <label><input type="radio" name="visibility" value="community" checked={visibility === 'community'} onChange={() => setVisibility('community')}/><span>{t('comp.community')}<small>{t('comp.pending')}</small></span></label>
          <label><input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')}/><span>{t('comp.onlyMe')}<small>{t('comp.privateJournal')}</small></span></label>
        </div></fieldset>
        {isOld && <>
          <label className="consent-row"><input type="checkbox" checked={voiceConsent} onChange={(event) => { setVoiceConsent(event.target.checked); if (!event.target.checked) { setRecording(false); setVoiceSample(null); } }} /> {t('story.voiceConsent')}</label>
          {voiceConsent && !recording && <button type="button" className="secondary" onClick={() => setRecording(true)}>{t('story.recordVoice')}</button>}
          {voiceConsent && recording && <VoiceSampleRecorder sentence={t('story.sentenceText')} onRecorded={(dataUrl) => setVoiceSample(dataUrl)} />}
        </>}
        <label className="consent-row"><input type="checkbox" name="consent" /> {t('posts.consentAi')}</label>
        {error && <p className="form-error">{error}</p>}
        <div className="inline-actions">
          <button type="button" className="secondary" disabled={saving} onClick={() => setComposing(false)}>{t('common.cancel')}</button>
          <button className="primary" type="submit" disabled={saving}>{saving ? t('comp.saving') : t('posts.submit')}</button>
        </div>
      </form>
    ) : (
      <button className="primary wide" onClick={() => setComposing(true)}>{t('posts.postHere')}</button>
    )}
  </div>;
}

function DemoNarration({ segment, profile }) {
  const placeId = segment?.to?.id;
  const distanceM = segment ? Math.max(1, Math.round(segment.to.progress - segment.from.progress)) : 0;
  const fastSec = Math.max(1, Math.round(distanceM / (45 / 3.6)));   // 左：快 + 建筑
  const slowSec = Math.max(1, Math.round(distanceM / (10 / 3.6)));   // 右：慢 + 美食
  const normalSec = Math.max(1, Math.round(distanceM / (30 / 3.6))); // 试乘实际车速，用于中文单条讲解
  const [language, setLanguage] = useState(defaultNarration);
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
        <b>{side === 'left' ? t('demo.fast') : t('demo.slow')}</b>
        <span className="compare-persona">{side === 'left' ? t('demo.archLover') : t('demo.foodLover')}</span>
      </div>
      <div className="compare-metrics">
        <span>{result ? t('demo.toNext', { m: distanceM, s: result.sec }) : '…'}</span>
        <em>{result ? t('demo.audio', { len: result.story?.length ? t(`len.${result.story.length}`) : '', s: result.story?.durationSec ?? '…' }) : '…'}</em>
      </div>
      {result?.story?.hookText && <div className={`compare-hook ${tone}`}><small>{t('demo.injected')}</small>{result.story.hookText}</div>}
      <p className="compare-base">{result?.story?.baseText || t('demo.preparing')}</p>
      <button className={`compare-play ${playing === side ? 'is-on' : ''}`} onClick={() => playSide(side, result)} disabled={!result}>
        {playing === side ? t('common.stop') : t('common.listen')}
      </button>
    </div>
  );

  if (collapsed) {
    return <div className="speed-compare page-enter collapsed" onClick={toggleCollapse}>
      <div className="player-mini-row">
        <button className="play mini" onClick={(e) => { e.stopPropagation(); togglePlay(); }} disabled={!activeStory}>{playing ? 'Ⅱ' : '▶'}</button>
        <div className="player-mini-title">
          <b>{placeName(segment.to)}</b>
          <small>{language === 'en' ? t('demo.speedCompare') : t(`narr.${language}`)}</small>
        </div>
        <button className="mini-icon" title={t('common.expand')} aria-label={t('common.expand')} onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}>⌃</button>
      </div>
    </div>;
  }

  return <div className="speed-compare page-enter">
    <div className="sheet-handle" />
    <button className="sheet-collapse" onClick={toggleCollapse} title={t('player.collapse')} aria-label={t('player.collapse')}>⌄</button>
    <div className="language-toggle">
      <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>{t('narr.en')}</button>
      <button className={language === 'zh-HK' ? 'active' : ''} onClick={() => setLanguage('zh-HK')}>{t('narr.zh-HK')}</button>
      <button className={language === 'zh-CN' ? 'active' : ''} onClick={() => setLanguage('zh-CN')}>{t('narr.zh-CN')}</button>
    </div>
    <span className="eyebrow">{t('demo.eyebrow', { place: placeName(segment.to) })}</span>
    {language === 'en' ? (
      <div className="compare-cols">
        {renderCol(left, 'left', 'fast')}
        {renderCol(right, 'right', 'slow')}
      </div>
    ) : (
      <div className="compare-single">
        <p className="compare-base">{single?.story?.text || t('player.loadingStory')}</p>
        <button className={`compare-play ${playing === 'single' ? 'is-on' : ''}`} onClick={() => playSide('single', single)} disabled={!single}>
          {playing === 'single' ? t('common.stop') : t('common.listen')}
        </button>
      </div>
    )}
    {language === 'en' && <p className="compare-note">{t('demo.note')}</p>}
  </div>;
}

function MapScreen({ profile, onPostAdded, onChangeLanguage, postHint = false, onDismissPostHint, startPost = null }) {
  const [route, setRoute] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [onlineResults, setOnlineResults] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState(null);
  // Two modes: 'bus' (search a stop → pick a route through it) and 'explore'
  // (search any place → post there).
  const [mode, setMode] = useState('bus');
  const [busData, setBusData] = useState(null);
  const [busState, setBusState] = useState('idle'); // idle | loading | ready | missing | error
  const [stopResults, setStopResults] = useState([]);
  const [pickedStop, setPickedStop] = useState(null);
  const [busRoute, setBusRoute] = useState(null); // key of the lit route, null = demo route
  const [busStop, setBusStop] = useState(null); // stop whose routes are on the map
  const [currentPlaceId, setCurrentPlaceId] = useState(null);
  const [timeToNextSec, setTimeToNextSec] = useState(null);
  const [chromeCollapsed, setChromeCollapsed] = useState(false);
  const [postsPlace, setPostsPlace] = useState(null);
  const [nearbyPlace, setNearbyPlace] = useState(null);
  const [segment, setSegment] = useState(null);
  const [demoing, setDemoing] = useState(false);
  const [postedPlaces, setPostedPlaces] = useState([]);
  const [placeCommunity, setPlaceCommunity] = useState(null);
  const [timeTravel, setTimeTravel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRoute({ mode: 'demo' }).then((nextRoute) => { if (!cancelled) setRoute(nextRoute); });
    getPostedPlaces().then((list) => { if (!cancelled) setPostedPlaces(list); });
    return () => { cancelled = true; };
  }, []);

  // 打卡点 + 用户在地图上任意地点发过帖的位置，作为一层独立于路线的标记
  const mapCheckpoints = useMemo(() => [...checkpointList, ...postedPlaces], [postedPlaces]);
  const [postEra, setPostEra] = useState(null);
  useEffect(() => {
    if (!startPost?.place) return;
    setMode('explore');
    setFocus({ place: startPost.place, at: startPost.at });
    setPostEra(startPost.era || 'MODERN');
    setPostsPlace(startPost.place);
  }, [startPost]);
  const handlePostAdded = (created) => {
    getPostedPlaces().then(setPostedPlaces);
    onPostAdded?.(created);
  };

  // Heritage stops open the immersive then-and-now door; every other pin
  // (check-in point, district, tapped spot) keeps the post sheet.
  const handleSelectPlace = (place) => {
    if (place?.id && isHeritagePlace(place.id)) { setPlaceCommunity(place); setTimeTravel(false); }
    else setPostsPlace(place);
  };

  // Bus data loads on first use of the bus search.
  const ensureBusData = () => {
    if (busData || busState === 'loading') return Promise.resolve(busData);
    setBusState('loading');
    return loadBusData()
      .then((data) => { setBusData(data); setBusState('ready'); return data; })
      .catch((error) => { setBusState(error.code === 'missing' ? 'missing' : 'error'); return null; });
  };

  const typeQuery = (value) => {
    setQuery(value);
    setOnlineResults(null);
    if (mode === 'bus') {
      setPickedStop(null);
      if (busData) setStopResults(searchStops(busData, value));
      else ensureBusData().then((data) => data && setStopResults(searchStops(data, value)));
      return;
    }
    setSuggestions(searchLocalPlaces(value));
  };
  // Explore mode: our own sights while typing; the map service on submit.
  const submitSearch = async (event) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (mode === 'bus') { typeQuery(q); return; }
    setSuggestions(searchLocalPlaces(q));
    setSearching(true);
    try { setOnlineResults(await searchOnlinePlaces(q, { language: getLanguage() })); }
    catch { setOnlineResults([]); }
    finally { setSearching(false); }
  };
  const pickResult = (place) => {
    setFocus({ place, at: Date.now() });
    setSuggestions([]);
    setOnlineResults(null);
    setQuery(placeName(place));
  };
  const clearSearch = () => { setQuery(''); setSuggestions([]); setOnlineResults(null); setStopResults([]); setPickedStop(null); };
  const switchMode = (next) => { if (next !== mode) { setMode(next); clearSearch(); } };

  const pickStop = (group) => { setPickedStop(group); setQuery(busName(group, getLanguage())); };
  // Every route through the chosen stop is drawn dimmed; the picked one is lit.
  // Tapping another number in the strip switches which one is lit.
  const routeKey = (r) => `${r.op}|${r.route}|${r.bound}`;
  const pickRoute = async (r, stop = pickedStop || busStop) => {
    clearSearch();
    setBusStop(stop);
    setBusRoute(routeKey(r));
    const others = stop ? routesAtGroup(busData, stop).filter((o) => routeKey(o) !== routeKey(r)) : [];
    const ghostPaths = others.map((o) => routeForMap(busData, o, getLanguage()).path);
    const lit = isDemoRoute(r) ? await getRoute({ mode: 'demo' }) : routeForMap(busData, r, getLanguage());
    setRoute({ ...lit, ghostPaths, focusStop: stop ? { lat: stop.lat, lng: stop.lng } : null });
  };
  const backToDemoRoute = async () => { setBusRoute(null); setBusStop(null); setRoute(await getRoute({ mode: 'demo' })); };

  const stopRoutes = pickedStop && busData ? routesAtGroup(busData, pickedStop) : [];
  const searchOpen = Boolean(query.trim()) && (mode === 'bus'
    ? true
    : suggestions.length > 0 || onlineResults !== null || searching);

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
    <div className="map-canvas"><MapView route={route} checkpoints={mapCheckpoints} mode={mode === 'bus' ? 'bus' : 'walk'} focus={focus} onArrive={handleArrive} onSelectPlace={handleSelectPlace} onSegmentChange={setSegment} onNearbyPlace={setNearbyPlace} onDemoingChange={setDemoing} /></div>
    <div className="mode-switch">
      <button className={mode === 'bus' ? 'active' : ''} onClick={() => switchMode('bus')}>{t('map.modeBus')}</button>
      <button className={mode === 'explore' ? 'active' : ''} onClick={() => switchMode('explore')}>{t('map.modeExplore')}</button>
    </div>
    {nearbyPlace && (
      <button className="nearby-toast" onClick={() => setPostsPlace(nearbyPlace)}>
        <b>{t('map.nearbyTitle', { place: placeName(nearbyPlace) })}</b>
        <span>{t('map.nearbySub')}</span>
      </button>
    )}
    {chromeCollapsed ? (
      <button className="chrome-mini" onClick={() => setChromeCollapsed(false)}>
        <span className="brand-mark chrome-mini-mark">LR</span><b>{t('map.show')}</b>
      </button>
    ) : (
      <>
        <header className="floating-header"><span className="brand-mark">LR</span><div><b>Living Routes</b><small>{t('brand.small')}</small></div><button className="avatar lang-button" onClick={onChangeLanguage} title={t('common.changeLanguage')} aria-label={t('common.changeLanguage')}>{({ en: 'EN', 'zh-HK': '繁', 'zh-CN': '简' })[getLanguage()]}</button><button className="chrome-close" onClick={() => setChromeCollapsed(true)} title={t('map.hideHeader')} aria-label={t('map.hideHeader')}>⌃</button></header>
        <form className="route-search place-search" onSubmit={submitSearch} role="search">
          <span>⌕</span>
          <input value={query} onChange={(e) => typeQuery(e.target.value)} placeholder={t(mode === 'bus' ? 'map.busSearchPlaceholder' : 'map.searchPlaceholder')} aria-label={t(mode === 'bus' ? 'map.busSearchPlaceholder' : 'map.searchPlaceholder')} onFocus={() => mode === 'bus' && ensureBusData()}/>
          {query && <button type="button" className="place-search-clear" onClick={clearSearch} aria-label={t('common.close')}>×</button>}
          <button type="submit" disabled={searching}>{t('map.searchBtn')}</button>
        </form>
        {searchOpen && mode === 'explore' && <div className="place-search-results" role="listbox">
          {suggestions.map((place) => <button type="button" key={place.id} onClick={() => pickResult(place)}><b>{placeName(place)}</b><small>{t(place.kind === 'district' ? 'map.resultDistrict' : 'map.resultSight')}</small></button>)}
          {searching && <p>{t('map.searching')}</p>}
          {onlineResults?.map((place) => <button type="button" key={place.id} onClick={() => pickResult(place)}><b>{placeName(place)}</b><small>{place.address}</small></button>)}
          {onlineResults && !searching && onlineResults.length === 0 && suggestions.length === 0 && <p>{t('map.noResults')}</p>}
          {!onlineResults && !searching && <p className="place-search-hint">{t('map.searchMoreHint')}</p>}
        </div>}
        {searchOpen && mode === 'bus' && <div className="place-search-results bus-results" role="listbox">
          {busState === 'loading' && <p>{t('map.busLoading')}</p>}
          {busState === 'missing' && <p>{t('map.busMissing')}</p>}
          {busState === 'error' && <p>{t('map.busError')}</p>}
          {busData && !pickedStop && stopResults.map((g) => <button type="button" key={g.id} onClick={() => pickStop(g)}><b>{busName(g, getLanguage())}</b><small>{t('map.busRouteCount', { n: g.routeCount })}</small></button>)}
          {busData && !pickedStop && stopResults.length === 0 && <p>{t('map.busNoStops')}</p>}
          {pickedStop && <>
            <p className="bus-results-head">{t('map.busRoutesAt', { stop: busName(pickedStop, getLanguage()) })}</p>
            {stopRoutes.map((r) => <button type="button" key={`${r.op}-${r.route}-${r.bound}`} className="bus-route-option" onClick={() => pickRoute(r)}>
              <b><span className={`bus-badge op-${r.op}`}>{r.route}</span>{t('map.busTo', { dest: busName(r.dest, getLanguage()) })}{isDemoRoute(r) && <em>{t('map.busNarrated')}</em>}</b>
              <small>{operatorName(r.op, getLanguage())} · {t('map.busFrom', { orig: busName(r.orig, getLanguage()) })}</small>
            </button>)}
          </>}
        </div>}
      </>
    )}
    {mode === 'bus' && busStop && busData && !chromeCollapsed && !searchOpen && <div className="bus-route-strip">
      <div className="bus-route-strip-head"><span>{t('map.busRoutesAt', { stop: busName(busStop, getLanguage()) })}</span><button type="button" onClick={backToDemoRoute}>{t('map.busBackToDemo')}</button></div>
      <div className="bus-route-strip-list">{routesAtGroup(busData, busStop).map((r) => <button type="button" key={routeKey(r)} className={`bus-strip-option ${busRoute === routeKey(r) ? 'is-lit' : ''}`} onClick={() => pickRoute(r, busStop)} title={t('map.busTo', { dest: busName(r.dest, getLanguage()) })}>
        <span className={`bus-badge op-${r.op}`}>{r.route}</span><small>{t('map.busTo', { dest: busName(r.dest, getLanguage()) })}</small>
      </button>)}</div>
    </div>}
    {postHint && !postsPlace && <button type="button" className="map-post-hint" onClick={onDismissPostHint}><b>{t('map.postHintTitle')}</b><span>{t('map.postHint')}</span><i aria-hidden="true">×</i></button>}
    {playerOpen && <PlayerSheet profile={profile} placeId={currentPlaceId} remainingTimeSec={timeToNextSec} onClose={() => setPlayerOpen(false)} />}
    {segment && demoing && <DemoNarration segment={segment} profile={profile} />}
    {postsPlace && <PlacePostsSheet key={postsPlace.id} place={postsPlace} profile={profile} initialEra={postEra} onClose={() => { setPostsPlace(null); setPostEra(null); }} onPostAdded={handlePostAdded} />}
    {placeCommunity && <PlaceCommunity place={placeCommunity} onClose={() => setPlaceCommunity(null)} onOpenTimeMachine={() => setTimeTravel(true)} onPost={(place) => { setPlaceCommunity(null); setPostsPlace(place); }} />}
    {placeCommunity && timeTravel && <TimeMachine key={placeCommunity.id} place={placeCommunity} onClose={() => setTimeTravel(false)} />}
  </section>;
}

// A post made from the map goes exactly where the user tapped: a district pin
// stays a district post; a heritage stop / check-in point keeps its id; a
// tapped spot or Google place stores its own name and coordinates. Every
// place post is also filed under its nearest district so it joins the
// Community wall for that area.
function locationOfMapPlace(place) {
  if (place.kind === 'district') return { locationType: 'district', districtId: place.id };
  const district = nearestDistrict(place);
  const carriesOwnCoords = place.kind === 'user-place' || place.kind === 'landmark';
  return { locationType: 'place', location: carriesOwnCoords ? place : place.id, districtId: district?.id || null };
}

// 发帖地点：文化路线 5 站 + 打卡点 + 其他（自由填写）
function postLocationFromForm(form) {
  const locationType = form.get('locationType') || 'none';
  return { locationType, districtId: form.get('district') || null,
    location: locationType === 'place' ? (form.get('place') === '__other' ? (form.get('placeOther') || '').trim() : form.get('place')) : null };
}

function PlaceSelect({ initialPlace } = {}) {
  const known = initialPlace && initialPlace.kind !== 'user-place' && initialPlace.kind !== 'district';
  const [mode, setMode] = useState(known ? 'place' : 'district');
  const [value, setValue] = useState(known ? initialPlace.id : initialPlace?.kind === 'user-place' ? '__other' : '');
  return <>
    <label>{t('loc.mode')}<select name="locationType" value={mode} onChange={(event) => setMode(event.target.value)}><option value="district">{t('loc.district')}</option><option value="place">{t('loc.place')}</option><option value="none">{t('loc.none')}</option></select></label>
    {mode !== 'none' && <label>{t('loc.district')}<select name="district" required={mode === 'district'} defaultValue={getDistrict(initialPlace?.id)?.id || ''}><option value="">{t(mode === 'district' ? 'loc.choose' : 'loc.optional')}</option>{districts.map((district) => <option value={district.id} key={district.id}>{placeName(district)}</option>)}</select></label>}
    {mode === 'place' && <><label>{t('comp.place')}<select name="place" required value={value} onChange={(e) => setValue(e.target.value)}>
      <option value="">{t('comp.placeChoose')}</option>
      {postLocationGroups().map((group) => <optgroup key={group.key} label={t(group.key === 'heritage' ? 'comp.groupHeritage' : 'comp.groupCheckpoints')}>
        {group.items.map((item) => <option key={item.id} value={item.id}>{placeName(item)}</option>)}
      </optgroup>)}
      <option value="__other">{t('comp.placeOther')}</option>
    </select></label>
    {value === '__other' && <label>{t('comp.placeOther')}<input name="placeOther" required defaultValue={initialPlace?.kind === 'user-place' ? placeName(initialPlace) : ''} placeholder={t('comp.placeOtherPh')}/></label>}</>}
    <p className="location-note">{t(mode === 'none' ? 'loc.noneNote' : 'loc.note')}</p>
  </>;
}

const photoStyles = ['original', 'cartoon', 'cyberpunk', 'pencil', 'none'];

function PhotoStylePicker({ name = 'photoStyle', value = 'original', onChange }) {
  return <fieldset className="style-picker">
    <legend>{t('style.legend')}</legend>
    <div>{photoStyles.map((option) => <label key={option}><input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)}/><span>{t(`style.${option}`)}</span></label>)}</div>
    <small>{t('style.note')}</small>
  </fieldset>;
}

function PhotoUpload({ name = 'photo', large = false, photoStyle = 'original' }) {
  const [sourcePreview, setSourcePreview] = useState('');
  const [preview, setPreview] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sourcePreview || photoStyle === 'none') {
      setPreview('');
      setPreviewBusy(false);
      return () => { cancelled = true; };
    }
    if (photoStyle === 'original') {
      setPreview(sourcePreview);
      setPreviewBusy(false);
      return () => { cancelled = true; };
    }
    setPreviewBusy(true);
    applyPhotoStyle(sourcePreview, photoStyle)
      .then((result) => { if (!cancelled) setPreview(result || sourcePreview); })
      .catch(() => { if (!cancelled) setError(t('upload.errStyle')); })
      .finally(() => { if (!cancelled) setPreviewBusy(false); });
    return () => { cancelled = true; };
  }, [photoStyle, sourcePreview]);

  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    setSourcePreview('');
    setPreview('');
    setFileName('');
    setError('');
    if (!file) return;

    const supported = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!supported) {
      event.target.value = '';
      setError(t('upload.errType'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      event.target.value = '';
      setError(t('upload.errSize'));
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setSourcePreview(reader.result);
    reader.onerror = () => setError(t('upload.errPreview'));
    reader.readAsDataURL(file);
  };

  return <label className={`upload photo-upload ${large ? 'large' : ''}`}>
    {preview ? <img className={`photo-style-${photoStyle}`} src={preview} alt={t('upload.alt')}/> : <span className="upload-plus">＋</span>}
    <b>{fileName || (large ? t('upload.addLarge') : t('upload.add'))}</b>
    <small>{error || (previewBusy ? t('upload.preparing') : photoStyle === 'none' && fileName ? t('upload.hidden') : fileName ? t('upload.previewReplace', { style: t(`style.${photoStyle}`) }) : t('upload.formats'))}</small>
    <input type="file" name={name} accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={choosePhoto}/>
  </label>;
}

function ExpandableText({ children, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const text = String(children || '');
  const needsToggle = Array.from(text).length > (compact ? 72 : 110);

  return <div className={`expandable-copy ${expanded ? 'expanded' : ''}`}>
    <p>{text}</p>
    {needsToggle && <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
      {expanded ? t('common.showLess') : t('common.readMore')}
    </button>}
  </div>;
}

function DeletePostButton({ onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setDeleting(true);
    try { await onDelete(); }
    catch (error) { setError(error.message); }
    finally { setDeleting(false); }
  };

  if (!confirming) return <button type="button" className="delete-post" onClick={() => setConfirming(true)}>{t('del.delete')}</button>;
  return <div className="delete-confirm">
    {error && <span role="alert">{error}</span>}
    <span>{t('del.confirm')}</span>
    <button type="button" onClick={remove} disabled={deleting}>{deleting ? t('del.deleting') : t('del.yes')}</button>
    <button type="button" onClick={() => setConfirming(false)} disabled={deleting}>{t('common.cancel')}</button>
  </div>;
}

function ComposeOverlay({ children, onClose, busy, title }) {
  const [viewport, setViewport] = useState(null);
  const overlayRef = useRef(null);
  useEffect(() => {
    const update = () => {
      const view = window.visualViewport;
      setViewport({ height: view?.height || window.innerHeight, top: view?.offsetTop || 0 });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    const shell = document.querySelector('.app-shell');
    const previousInert = shell?.inert;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    if (shell) shell.inert = true;
    document.body.style.overflow = 'hidden';
    overlayRef.current?.querySelector('button')?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      if (shell) shell.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, []);
  const handleKey = (event) => {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key !== 'Tab') return;
    const focusable = [...overlayRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, select, [tabindex="0"]')].filter((element) => element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return createPortal(<div ref={overlayRef} className="modal-backdrop compose-overlay" role="dialog" aria-modal="true" aria-label={title} onKeyDown={handleKey} style={viewport ? { height: viewport.height, top: viewport.top } : undefined}>{children}</div>, document.body);
}

function CommunityScreen({ profile, onPostAdded, onGoToMap }) {
  const [placeCommunity, setPlaceCommunity] = useState(null);
  const [timeTravel, setTimeTravel] = useState(false);
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState([]);
  const [composer, setComposer] = useState(false);
  const [composerVisibility, setComposerVisibility] = useState('private');
  const [composerPhotoStyle, setComposerPhotoStyle] = useState('original');
  const [savedNotice, setSavedNotice] = useState('');
  const [voiceDemo, setVoiceDemo] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [syncingPost, setSyncingPost] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [composerError, setComposerError] = useState('');
  const [composerKind, setComposerKind] = useState('tourist'); // 'tourist' | 'local' (elder story)
  const [storyVoiceConsent, setStoryVoiceConsent] = useState(false);
  const [storyVoiceSample, setStoryVoiceSample] = useState(null);
  const [storyRecording, setStoryRecording] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPosts().then((result) => {
      if (!cancelled) { setPosts(result); setLoadError(''); }
    }).catch((error) => { if (!cancelled) setLoadError(error.message); });
    return () => { cancelled = true; };
  }, [refreshVersion]);

  // Posts this browser marked public but could not upload earlier (offline,
  // backend not set up yet) are published quietly when the page opens.
  useEffect(() => {
    if (!sharedCommunityEnabled) return;
    shareAllSavedCommunityPosts()
      .then((result) => { if (result.published.length) setRefreshVersion((value) => value + 1); })
      .catch(() => { /* try again next visit */ });
  }, []);

  const submitPost = async (event) => {
    event.preventDefault();
    setSavedNotice('');
    if (savingPost) return;
    setComposerError('');
    const form = new FormData(event.currentTarget);
    const file = form.get('photo');
    setSavingPost(true);
    try {
      const isLocal = composerKind === 'local';
      const created = await addPost({
        photo: file?.size && form.get('photoStyle') !== 'none' ? file : undefined,
        text: form.get('memory'),
        ...postLocationFromForm(form),
        role: isLocal ? 'local' : 'tourist',
        era: isLocal ? 'ARCHIVAL' : 'MODERN',
        consent: form.get('consent') === 'on',
        voiceConsent: isLocal && storyVoiceConsent,
        voiceSample: isLocal ? storyVoiceSample : null,
        visibility: isLocal ? 'community' : form.get('visibility'),
        photoStyle: form.get('photoStyle'),
        author: profile?.ethicsConsent?.signedName || t('comm.authorDefault'),
      });
      if (created.visibility === 'community') setPosts((current) => [created, ...current]);
      setSavedNotice(created.localSaveFailed ? t('comm.cloudOnly') : created.visibility === 'community'
        ? t(created.shared ? 'comm.postedPending' : 'comm.localOnly')
        : t('comm.savedPrivate'));
      setComposer(false);
      onPostAdded?.();
    } catch (error) {
      setComposerError(t('comm.photoNotSaved', { msg: error.message }));
    } finally { setSavingPost(false); }
  };

  const syncAllPosts = async () => {
    setSyncingPost('all');
    try {
      const result = await shareAllSavedCommunityPosts();
      setSavedNotice(t('comm.syncResult', { count: result.published.length, failed: result.failed.length })
        + (result.failed.length ? ` · ${result.failed[0].message}` : ''));
      setRefreshVersion((value) => value + 1);
      onPostAdded?.();
    } catch (error) { setSavedNotice(error.message); }
    finally { setSyncingPost(null); }
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
      voiceReplicaConsent: form.get('voiceReplicaConsent') === 'on',
    });
    setVoiceResult(result);
    setVoiceLoading(false);
  };

  const matches = search.trim()
    ? places.filter((p) => `${placeName(p)} ${p.nameEn}`.toLowerCase().includes(search.trim().toLowerCase()))
    : [];

  return <section className="screen community-screen page-enter">
    <header className="section-header"><span className="eyebrow">{t('comm.eyebrow')}</span><h1>{t('comm.title')}</h1><p>{t('comm.intro')}</p>{savedNotice && <div className="save-notice">✓ {savedNotice}</div>}</header>
    {loadError && <p className="form-error community-error" role="alert">{loadError} <button type="button" onClick={() => setRefreshVersion((value) => value + 1)}>{t('comm.retry')}</button></p>}
    <CommunityPhotoWall posts={posts} onOpenPlace={(place) => { setPlaceCommunity(place); setTimeTravel(false); }} onAddStory={(place, era) => onGoToMap?.(place, era)} />
    <button type="button" className="voice-demo-link" onClick={() => { setVoiceDemo(true); setVoiceResult(null); }}>{t('comm.voiceTrigger')}</button>
    {placeCommunity && <PlaceCommunity place={placeCommunity} onClose={() => setPlaceCommunity(null)} onOpenTimeMachine={() => setTimeTravel(true)} onPost={(place) => { setPlaceCommunity(null); onGoToMap?.(place, 'MODERN'); }} />}
    {placeCommunity && timeTravel && <TimeMachine key={placeCommunity.id} place={placeCommunity} onClose={() => setTimeTravel(false)} />}
    <button className="fab" aria-label={t('jr.postOnMap')} onClick={() => (onGoToMap ? onGoToMap() : (setComposerError(''), setComposerVisibility('private'), setComposerPhotoStyle('original'), setComposerKind('tourist'), setStoryVoiceConsent(false), setStoryRecording(false), setStoryVoiceSample(null), setComposer(true)))}>＋</button>
    {composer && <ComposeOverlay title={t(composerKind === 'local' ? 'story.title' : 'comp.title')} busy={savingPost} onClose={() => setComposer(false)}>
      <form className="compose-card memory-compose" onSubmit={submitPost} aria-busy={savingPost}>
        <header className="compose-header"><button type="button" className="close" aria-label={t('common.close')} disabled={savingPost} onClick={() => setComposer(false)}>×</button><span className="eyebrow">{composerKind === 'local' ? t('story.eyebrow') : t('comp.eyebrow')}</span><h2>{composerKind === 'local' ? t('story.title') : t('comp.title')}</h2></header>
        <div className="compose-fields"><fieldset disabled={savingPost} className="compose-inputs">
          <div className="segmented compose-kind">
            <button type="button" className={composerKind === 'tourist' ? 'active' : ''} onClick={() => setComposerKind('tourist')}>{t('comp.kindTourist')}</button>
            <button type="button" className={composerKind === 'local' ? 'active' : ''} onClick={() => setComposerKind('local')}>{t('comp.kindLocal')}</button>
          </div>
          <PlaceSelect /><label>{composerKind === 'local' ? t('story.text') : t('comp.story')}<textarea name="memory" required placeholder={composerKind === 'local' ? t('story.textPh') : t('comp.storyPlaceholder')}/></label>
          <PhotoUpload photoStyle={composerPhotoStyle}/><PhotoStylePicker value={composerPhotoStyle} onChange={setComposerPhotoStyle}/>
          {composerKind === 'local' ? (
            <>
              <label className="consent-row"><input type="checkbox" checked={storyVoiceConsent} onChange={(event) => { setStoryVoiceConsent(event.target.checked); if (!event.target.checked) { setStoryRecording(false); setStoryVoiceSample(null); } }} /> {t('story.voiceConsent')}</label>
              {storyVoiceConsent && !storyRecording && <button type="button" className="secondary" onClick={() => setStoryRecording(true)}>{t('story.recordVoice')}</button>}
              {storyVoiceConsent && storyRecording && <VoiceSampleRecorder sentence={t('story.sentenceText')} onRecorded={(dataUrl) => setStoryVoiceSample(dataUrl)} />}
            </>
          ) : (
            <>
              <fieldset className="visibility-picker"><legend>{t('comp.visibility')}</legend><div>
                <label><input type="radio" name="visibility" value="private" checked={composerVisibility === 'private'} onChange={() => setComposerVisibility('private')}/><span>{t('comp.onlyMe')}<small>{t('comp.privateJournal')}</small></span></label>
                <label><input type="radio" name="visibility" value="community" checked={composerVisibility === 'community'} onChange={() => setComposerVisibility('community')}/><span>{t('comp.community')}<small>{t('comp.pending')}</small></span></label>
              </div></fieldset><label className="consent-row"><input type="checkbox" name="consent"/> {t('comp.consent')}</label>
            </>
          )}
        </fieldset></div>
        <footer className="compose-actions">{composerError && <p className="form-error" role="alert">{composerError}</p>}<button type="submit" className="primary wide" disabled={savingPost}>{savingPost ? t('comp.saving') : composerKind === 'local' ? t('story.postBtn') : composerVisibility === 'community' ? t('comp.postBtn') : t('comp.saveBtn')}</button></footer>
      </form>
    </ComposeOverlay>}
    {voiceDemo && <div className="modal-backdrop"><div className="compose-card voice-card"><button type="button" className="close" onClick={() => setVoiceDemo(false)}>×</button>{!voiceResult ? <><span className="eyebrow">{t('voice.eyebrow')}</span><h2>{t('voice.title')}</h2><p className="modal-intro">{t('voice.intro')}</p><form onSubmit={submitVoice}><label>{t('voice.place')}<select name="voicePlace" defaultValue="blue-house">{['blue-house', 'lee-tung-street', 'central-market'].map((id) => <option key={id} value={id}>{placeName(getPlaceById(id))}</option>)}</select></label><label className="upload">{t('voice.add')} <input type="file" name="voice" accept="audio/*"/><small>{t('voice.optional')}</small></label><label>{t('voice.transcript')} <textarea name="voiceTranscript" placeholder={t('voice.transcriptPh')}/></label><div className="voice-consents"><label className="consent-row"><input type="checkbox" name="voiceConsent"/> {t('voice.consent')}</label><label className="consent-row"><input type="checkbox" name="voiceReplicaConsent"/> {t('voice.replica')}</label><small>{t('voice.replicaNote')}</small></div><button className="primary wide" disabled={voiceLoading}>{voiceLoading ? t('voice.processing') : t('voice.run')}</button></form></> : <VoiceResult result={voiceResult} onReset={() => setVoiceResult(null)} />}</div></div>}
  </section>;
}

function VoiceResult({ result, onReset }) {
  const draft = result.generatedStory.languages;
  const [language, setLanguage] = useState('zh-HK');
  const languageLabels = { 'zh-HK': t('narr.zh-HK'), 'zh-CN': t('narr.zh-CN'), en: t('narr.en') };
  return <div className="voice-result page-enter">
    <span className="eyebrow">{t('vr.eyebrow')}</span>
    <h2>{draft['zh-HK'].title}</h2>
    <div className="pipeline-steps"><span>{t('vr.step1')}</span><span>{t('vr.step2')}</span><span>{t('vr.step3')}</span><span>{t('vr.step4')}</span></div>
    <div className="result-block"><small>{t('vr.transcript')} · {result.transcription.language} · {result.transcription.method === 'user-provided-transcript' ? t('vr.userProvided') : t('vr.demoFallback')}</small><p>{result.transcription.text}</p><b>{t('vr.confidence', { n: Math.round(result.transcription.confidence * 100) })} · {result.input.fileName}</b></div>
    {result.input.voicePreviewUrl && <div className="voice-recording"><small>{t('vr.original')}</small><audio controls src={result.input.voicePreviewUrl} /></div>}
    <div className="voice-permission"><small>{t('vr.replicaLabel')}</small><b>{result.voiceOutput.replicaConsent ? t('vr.replicaYes') : t('vr.replicaNo')}</b><span>{t('vr.noClone')}</span></div>
    <div className="result-block"><small>{t('vr.signals')}</small><p>{result.extraction.themes.join(' · ')}</p><b>{result.extraction.factCheckNote}</b></div>
    <div className="language-preview">{Object.entries(languageLabels).map(([code, label]) => <button key={code} className={language === code ? 'active' : ''} onClick={() => setLanguage(code)}>{label}</button>)}<p><b>{draft[language].title}</b><br/>{draft[language].text}</p></div>
    <div className="review-callout"><b>{t('vr.next', { route: result.moderation.route })}</b><span>{result.moderation.reason}</span></div>
    <button className="secondary wide" onClick={onReset}>{t('vr.again')}</button>
  </div>;
}

function JournalScreen({ profile, onGoToMap }) {
  const [memories, setMemories] = useState([]);
  const [openMemory, setOpenMemory] = useState(null);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');

  useEffect(() => {
    if (!openMemory) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpenMemory(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMemory]);

  useEffect(() => {
    let cancelled = false;
    getMyPosts().then((result) => { if (!cancelled) setMemories(result); });
    return () => { cancelled = true; };
  }, []);

  const changeVisibility = async (memory, visibility) => {
    setVisibilityBusy(true);
    setVisibilityError('');
    try {
      const updated = await setPostVisibility(memory.id, visibility);
      setMemories((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setOpenMemory(updated);
    } catch (error) {
      setVisibilityError(error.message);
    } finally { setVisibilityBusy(false); }
  };

  const removeMemory = async (id) => {
    await deletePost(id);
    setMemories((current) => current.filter((memory) => memory.id !== id));
    setOpenMemory((current) => (current?.id === id ? null : current));
  };
  const memoryMeta = (memory) => [postPlace(memory), localDay(momentOf(memory)).replaceAll('-', '.'), memory.photoGps ? t('jr.gps') : '', memory.visibility === 'community' ? t('jr.community') : t('jr.onlyMe')].filter(Boolean).join(' · ');

  return <section className="screen journal-screen page-enter">
    <div className="private-banner">▣ <b>{t('jr.private')}</b></div>
    <header className="section-header"><span className="eyebrow">{t('jr.eyebrow')}</span><h1>{t('jr.title')}</h1><p>{t('jr.intro')}</p></header>
    <div className="journal-post-cta"><button type="button" className="primary wide" onClick={onGoToMap}>{t('jr.postOnMap')}</button><p className="location-note">{t('jr.postOnMapNote')}</p></div>
    {memories.length > 0 && <div className="memory-list">{memories.map((memory, index) => <article key={memory.id}><button type="button" className="memory-open" aria-label={t('jr.openDetail')} onClick={() => setOpenMemory(memory)}>{memory.image ? <img className={`photo-style-${memory.photoStyle || 'original'}`} src={memory.image} alt=""/> : <div className="memory-placeholder">{String(index + 1).padStart(2, '0')}</div>}</button><div><small>{memoryMeta(memory)}</small><ExpandableText compact>{memory.text}</ExpandableText><div className="memory-actions"><button type="button" className="memory-view" onClick={() => setOpenMemory(memory)}>{t('jr.openDetail')}</button><DeletePostButton onDelete={() => removeMemory(memory.id)}/></div></div></article>)}</div>}
    {memories.length === 0 && <p role="status">{t('jr.empty')}</p>}
    {openMemory && <div className="modal-backdrop memory-detail-backdrop" onClick={() => setOpenMemory(null)}>
      <article className="memory-detail" role="dialog" aria-modal="true" aria-label={postPlace(openMemory)} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="close" aria-label={t('common.close')} onClick={() => setOpenMemory(null)}>×</button>
        {openMemory.image && <img className={`photo-style-${openMemory.photoStyle || 'original'}`} src={openMemory.image} alt=""/>}
        <div className="memory-detail-body">
          <small>{memoryMeta(openMemory)}</small>
          <p>{openMemory.text}</p>
          <div className="memory-visibility">
            <span>{openMemory.visibility === 'community' ? t('jr.isPublic') : t('jr.isPrivate')}</span>
            <button type="button" className="secondary" disabled={visibilityBusy} onClick={() => changeVisibility(openMemory, openMemory.visibility === 'community' ? 'private' : 'community')}>
              {visibilityBusy ? t('jr.visibilityBusy') : openMemory.visibility === 'community' ? t('jr.makePrivate') : t('jr.makePublic')}
            </button>
            {visibilityError && <p className="form-error" role="alert">{visibilityError}</p>}
          </div>
        </div>
      </article>
    </div>}
    <MemoirStudio memories={memories}/>
  </section>;
}

export default function App() {
  const [uiLanguage, setUiLanguageState] = useState(null);
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const [ethicsConsent, setEthicsConsent] = useState(null);
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState('map');
  const [myPosts, setMyPosts] = useState([]);
  const [postHint, setPostHint] = useState(false);
  const [mapStartPost, setMapStartPost] = useState(null);
  // From the community wall or journal: open the map, on a place if we have one
  // (with its new/old choice preset), else with the "tap where it happened" hint.
  const goToMapToPost = (place = null, era = null) => {
    const located = place && place.lat != null && place.lng != null;
    setMapStartPost(located ? { place, era, at: Date.now() } : null);
    setPostHint(!located);
    setActive('map');
  };

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

  // Set before any child renders so t() reads the chosen language.
  setUiLanguage(uiLanguage);
  const pickLanguage = (code) => { setUiLanguage(code); setUiLanguageState(code); setPickingLanguage(false); };

  const content = useMemo(() => ({
    map: <MapScreen profile={fullProfile} onPostAdded={(created) => { setPostHint(false); refreshMyPosts(created); }} onChangeLanguage={() => setPickingLanguage(true)} postHint={postHint} onDismissPostHint={() => setPostHint(false)} startPost={mapStartPost} />,
    community: <CommunityScreen profile={fullProfile} onPostAdded={refreshMyPosts} onGoToMap={goToMapToPost} />,
    journal: <JournalScreen profile={fullProfile} onGoToMap={goToMapToPost} />,
  })[active], [active, fullProfile, uiLanguage, postHint, mapStartPost]);

  // Prototype-only preview, kept out of the normal flow.
  if (typeof window !== 'undefined' && window.location.hash === '#depthclip') return <DepthClipDemo />;

  if (!uiLanguage || pickingLanguage) return <LanguagePicker onPick={pickLanguage} />;
  if (!ethicsConsent) return <EthicsConsent onAccept={setEthicsConsent} />;
  if (!profile) return <Onboarding onFinish={(nextProfile) => setProfile({ ...nextProfile, ethicsConsent })} />;
  return <div className="app-shell">{content}<BottomNav active={active} setActive={setActive}/></div>;
}
