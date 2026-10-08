import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getThenNowImages, getPlaceStories } from '../services/thenNowService.js';
import { createNarrator } from '../services/ttsService.js';
import { getPosts } from '../services/communityService.js';
import { localizeStory } from '../content/stories.js';
import { getLanguage, placeName, t } from '../i18n.js';

const postText = (post, lang) => post.textI18n?.[lang] || post.text;
const postAuthor = (post, lang) => post.authorI18n?.[lang] || post.author;

// One heritage place's own community, two layers in a single scroll:
//   1. a full-screen split then/now photo with a "new ⇄ old" chat floating ON
//      the image — elders' memories on the old half, visitor posts on the new
//      half, as small translucent bubbles
//   2. a photo wall of framed posts (stories + visitor photos), revealed when
//      you pull down to scroll past the chat
export default function PlaceCommunity({ place, onClose, onOpenTimeMachine }) {
  const { past, now } = getThenNowImages(place?.id);
  const lang = getLanguage();
  const [posts, setPosts] = useState([]);
  const [detail, setDetail] = useState(null); // { type: 'story'|'post', data }
  const [playingId, setPlayingId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const scrollRef = useRef(null);

  const stories = useMemo(() => getPlaceStories(place?.id), [place?.id]);
  const narrator = useMemo(() => createNarrator({
    onStateChange: (s) => { if (s.state === 'ended' || s.state === 'idle') setPlayingId(null); },
  }), []);
  useEffect(() => () => narrator.stop(), [narrator]);

  useEffect(() => {
    let cancelled = false;
    setPosts([]); setLoadError('');
    getPosts({ placeId: place?.comparisonPostId ? undefined : place?.id, postId: place?.comparisonPostId })
      .then((r) => { if (!cancelled) setPosts(r); })
      .catch((error) => { if (!cancelled) setLoadError(error.message); });
    return () => { cancelled = true; };
  }, [place?.id]);

  const archival = posts.filter((p) => p.era === 'ARCHIVAL');
  const modern = posts.filter((p) => p.era !== 'ARCHIVAL');

  const playStory = (story) => {
    const id = `${story.placeId}:${story.track}`;
    if (playingId === id) { narrator.stop(); setPlayingId(null); return; }
    narrator.play(story, lang);
    setPlayingId(id);
  };

  const oldMsgs = useMemo(() => [
    ...stories.map((s) => ({ key: `story:${s.placeId}:${s.track}`, story: s, post: null, text: localizeStory(s, lang).title })),
    ...archival.map((p) => ({ key: p.id, story: null, post: p, text: postText(p, lang) })),
  ], [stories, archival, lang]);
  const newMsgs = useMemo(() => modern.map((p) => ({ key: p.id, story: null, post: p, text: postText(p, lang) })), [modern, lang]);

  // Reveal each bubble as it scrolls into view, for a "messages popping in" feel.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const bubbles = root.querySelectorAll('.pc-msg');
    if (typeof IntersectionObserver === 'undefined') {
      bubbles.forEach((b) => b.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { root, threshold: 0.15 });
    bubbles.forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, [oldMsgs, newMsgs]);

  const onMessage = (m) => {
    if (m.story) playStory(m.story);
    else setDetail({ type: 'post', data: m.post });
  };

  const renderBubble = (m, i, side) => (
    <div
      key={m.key}
      className={`pc-msg ${side}`}
      style={{ '--d': `${(i % 4) * 70}ms` }}
      role="button"
      tabIndex={0}
      onClick={() => onMessage(m)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onMessage(m); }}
    >
      {m.story && (
        <span className={`pc-msg-listen ${playingId === `${m.story.placeId}:${m.story.track}` ? 'on' : ''}`}>
          {playingId === `${m.story.placeId}:${m.story.track}` ? 'Ⅱ' : '▶'}
        </span>
      )}
      <span className="pc-msg-text">{m.text}</span>
      {m.post?.author && <span className="pc-msg-by">{postAuthor(m.post, lang)}</span>}
    </div>
  );

  const renderStoryCard = (story) => {
    const localized = localizeStory(story, lang);
    const id = `${story.placeId}:${story.track}`;
    return (
      <article className="pc-frame story" key={id} onClick={() => setDetail({ type: 'story', data: localized, image: past })}>
        <div className="pc-frame-img">
          {past?.url ? <img src={past.url} alt={placeName(place)} loading="lazy" /> : <div className="pc-frame-ph">{placeName(place)}</div>}
          <span className="pc-era then">{t('era.ARCHIVAL')}</span>
        </div>
        <div className="pc-frame-copy">
          <small>⌖ {placeName(place)}</small>
          <p>{localized.title}</p>
          <button type="button" className="pc-listen" onClick={(e) => { e.stopPropagation(); playStory(story); }}>
            {playingId === id ? 'Ⅱ' : '▶'} {t('wall.listen')}
          </button>
        </div>
      </article>
    );
  };

  const renderPostCard = (post, side) => (
    <article className="pc-frame post" key={post.id} onClick={() => setDetail({ type: 'post', data: post })}>
      <div className="pc-frame-img">
        {post.image ? <img className={`photo-style-${post.photoStyle || 'original'}`} src={post.image} alt={placeName(place)} loading="lazy" /> : <div className="pc-frame-ph">{placeName(place)}</div>}
        <span className={`pc-era ${side}`}>{t(`era.${post.era === 'ARCHIVAL' ? 'ARCHIVAL' : 'MODERN'}`)}</span>
      </div>
      <div className="pc-frame-copy">
        <small>⌖ {placeName(place)}</small>
        <p>{postText(post, lang)}</p>
        <b>{postAuthor(post, lang)}</b>
      </div>
    </article>
  );

  const oldCards = [...stories, ...archival.map((p) => ({ post: p }))];
  const nothingAtAll = oldCards.length === 0 && modern.length === 0;

  return createPortal(
    <div className="pc-door" role="dialog" aria-modal="true" aria-label={placeName(place) || t('loc.none')}>
      <button className="pc-close" onClick={onClose} aria-label={t('common.close')}>×</button>

      {/* 单个滚动容器：一整屏今昔照片（浮着新老聊天框）→ 下拉到照片墙 */}
      <div className="pc-scroll" ref={scrollRef}>
        <div className="pc-hero">
          <div className="pc-hero-img then">{past?.url ? <img src={past.url} alt="" /> : <div className="pc-hero-ph">{t('pc.thenEmpty')}</div>}</div>
          <div className="pc-hero-img now">{(modern.find((p) => p.image)?.image || now?.url) ? <img src={modern.find((p) => p.image)?.image || now.url} alt="" /> : <div className="pc-hero-ph">{placeName(place) || t('loc.none')}</div>}</div>
          <div className="pc-hero-line" />
          <div className="pc-hero-shade" />
          {past?.url && Number.isFinite(place?.lat) && Number.isFinite(place?.lng) && <button className="pc-time-travel" onClick={() => onOpenTimeMachine?.(place)}>
            <span className="pc-tt-zh">{t('pc.timeTravel')}</span>
            <span className="pc-tt-en">{t('pc.timeTravelEn')}</span>
          </button>}
          <header className="pc-head">
            <span className="eyebrow">{t('pc.eyebrow')}</span>
            <h1>{placeName(place) || t('loc.none')}</h1>
          </header>

          {/* 对话框：浮在照片上的新老对话气泡，老在旧照片一侧、新在新照片一侧 */}
          <div className="pc-chat">
            <div className="pc-chat-cols">
              <section className="pc-chat-col then">
                {oldMsgs.map((m, i) => renderBubble(m, i, 'old'))}
              </section>
              <div className="pc-chat-divider" />
              <section className="pc-chat-col now">
                {newMsgs.map((m, i) => renderBubble(m, i, 'new'))}
              </section>
            </div>
          </div>

        </div>

        {/* 下拉之后：照片墙（相框帖子） */}
        <div className="pc-wall">
          {loadError && <p role="alert">{loadError}</p>}
          {nothingAtAll ? (
            <p className="pc-wall-empty">{t('pc.empty')}</p>
          ) : (
            <div className="pc-wall-cols">
              <section className="pc-col then">
                <header className="pc-col-head"><b>{t('wall.then')}</b><small>{t('pc.thenSub')}</small></header>
                {stories.map(renderStoryCard)}
                {archival.map((p) => renderPostCard(p, 'then'))}
                {stories.length === 0 && archival.length === 0 && <p className="pc-col-empty">{t('pc.thenEmpty')}</p>}
              </section>
              <div className="pc-divider" />
              <section className="pc-col now">
                <header className="pc-col-head"><b>{t('wall.now')}</b><small>{t('pc.nowSub')}</small></header>
                {modern.map((p) => renderPostCard(p, 'now'))}
                {modern.length === 0 && <p className="pc-col-empty">{t('pc.nowEmpty')}</p>}
              </section>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div className="pc-detail" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="pc-detail-card" onClick={(e) => e.stopPropagation()}>
            <button className="pc-detail-close" onClick={() => setDetail(null)} aria-label={t('common.close')}>×</button>
            {detail.type === 'story' ? (
              <>
                {detail.image?.url && <img src={detail.image.url} alt="" className="pc-detail-img" />}
                <h2>{detail.data.title}</h2>
                <p>{detail.data.text}</p>
                {detail.data.disclosure && <small className="pc-detail-disclosure">{detail.data.disclosure}</small>}
              </>
            ) : (
              <>
                {detail.data.image && <img src={detail.data.image} alt="" className={`pc-detail-img photo-style-${detail.data.photoStyle || 'original'}`} />}
                <p>{postText(detail.data, lang)}</p>
                <b>{postAuthor(detail.data, lang)}</b>
                <small className="pc-detail-meta">⌖ {placeName(place)}</small>
              </>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
