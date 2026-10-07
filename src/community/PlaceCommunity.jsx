import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getThenNowImages, getPlaceStories } from '../services/thenNowService.js';
import { createNarrator } from '../services/ttsService.js';
import { getPosts } from '../services/communityService.js';
import { localizeStory } from '../content/stories.js';
import { getLanguage, placeName, t } from '../i18n.js';

const postText = (post, lang) => post.textI18n?.[lang] || post.text;
const postAuthor = (post, lang) => post.authorI18n?.[lang] || post.author;

// One heritage place's own community: a split then/now photo pinned at the top,
// and below it two columns of small chat bubbles that pop in — elders' memories
// under the old photo (sepia-yellow, black text), visitor posts under the new
// photo (white) — like two people texting across time.
export default function PlaceCommunity({ place, onClose, onOpenTimeMachine }) {
  const { past, now } = getThenNowImages(place?.id);
  const lang = getLanguage();
  const [posts, setPosts] = useState([]);
  const [detail, setDetail] = useState(null); // { type: 'post', data }
  const [playingId, setPlayingId] = useState(null);
  const scrollRef = useRef(null);

  const stories = useMemo(() => getPlaceStories(place?.id), [place?.id]);
  const narrator = useMemo(() => createNarrator({
    onStateChange: (s) => { if (s.state === 'ended' || s.state === 'idle') setPlayingId(null); },
  }), []);
  useEffect(() => () => narrator.stop(), [narrator]);

  useEffect(() => {
    let cancelled = false;
    getPosts({ placeId: place?.id }).then((r) => { if (!cancelled) setPosts(r); }).catch(() => {});
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

  // Two columns: old voices under the "then" photo, visitor posts under "now".
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

  return createPortal(
    <div className="pc-door" role="dialog" aria-modal="true" aria-label={placeName(place)}>
      <button className="pc-close" onClick={onClose} aria-label={t('common.close')}>×</button>

      {/* 顶部：今昔对比照片，固定在顶部，随滚动留在上面 */}
      <div className="pc-hero">
        <div className="pc-hero-img then">{past?.url ? <img src={past.url} alt="" /> : <div className="pc-hero-ph">{placeName(place)}</div>}</div>
        <div className="pc-hero-img now">{now?.url ? <img src={now.url} alt="" /> : <div className="pc-hero-ph">{placeName(place)}</div>}</div>
        <div className="pc-hero-line" />
        <div className="pc-hero-shade" />
        <button className="pc-time-travel" onClick={() => onOpenTimeMachine?.(place)}>
          <span className="pc-tt-zh">{t('pc.timeTravel')}</span>
          <span className="pc-tt-en">{t('pc.timeTravelEn')}</span>
        </button>
        <header className="pc-head">
          <span className="eyebrow">{t('pc.eyebrow')}</span>
          <h1>{placeName(place)}</h1>
        </header>
      </div>

      {/* 下方：帖子对话气泡，左右两栏对应当年/今天 */}
      <div className="pc-scroll" ref={scrollRef}>
        {oldMsgs.length === 0 && newMsgs.length === 0 ? (
          <p className="pc-chat-empty">{t('pc.empty')}</p>
        ) : (
          <div className="pc-chat">
            <section className="pc-chat-col then">
              {oldMsgs.map((m, i) => renderBubble(m, i, 'old'))}
            </section>
            <div className="pc-chat-divider" />
            <section className="pc-chat-col now">
              {newMsgs.map((m, i) => renderBubble(m, i, 'new'))}
            </section>
          </div>
        )}
      </div>

      {detail && (
        <div className="pc-detail" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="pc-detail-card" onClick={(e) => e.stopPropagation()}>
            <button className="pc-detail-close" onClick={() => setDetail(null)} aria-label={t('common.close')}>×</button>
            {detail.data.image && <img src={detail.data.image} alt="" className={`pc-detail-img photo-style-${detail.data.photoStyle || 'original'}`} />}
            <p>{postText(detail.data, lang)}</p>
            <b>{postAuthor(detail.data, lang)}</b>
            <small className="pc-detail-meta">⌖ {placeName(place)}</small>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
