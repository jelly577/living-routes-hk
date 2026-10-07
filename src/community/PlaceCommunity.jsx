import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getThenNowImages, getPlaceStories } from '../services/thenNowService.js';
import { createNarrator } from '../services/ttsService.js';
import { getPosts } from '../services/communityService.js';
import { localizeStory } from '../content/stories.js';
import { getLanguage, placeName, t } from '../i18n.js';

const postText = (post, lang) => post.textI18n?.[lang] || post.text;
const postAuthor = (post, lang) => post.authorI18n?.[lang] || post.author;

// One heritage place's own community: a hero split down the middle between its
// archival photo and today, a Hong Kong-style "時光之旅" button into the 360°
// time machine, and a photo-wall of its posts — old voices on the left, visitor
// posts on the right, each in a picture-frame card.
export default function PlaceCommunity({ place, onClose, onOpenTimeMachine }) {
  const { past, now } = getThenNowImages(place?.id);
  const lang = getLanguage();
  const [posts, setPosts] = useState([]);
  const [detail, setDetail] = useState(null); // { type: 'story'|'post', data }
  const [playingId, setPlayingId] = useState(null);

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
    <div className="pc-door" role="dialog" aria-modal="true" aria-label={placeName(place)}>
      <button className="pc-close" onClick={onClose} aria-label={t('common.close')}>×</button>

      <div className="pc-hero">
        <div className="pc-hero-img then">{past?.url ? <img src={past.url} alt={placeName(place)} /> : <div className="pc-hero-ph">{placeName(place)}</div>}</div>
        <div className="pc-hero-img now">{now?.url ? <img src={now.url} alt={placeName(place)} /> : <div className="pc-hero-ph">{placeName(place)}</div>}</div>
        <div className="pc-hero-line" />
        <div className="pc-hero-shade" />
        <button className="pc-time-travel" onClick={() => onOpenTimeMachine?.(place)}>
          <span className="pc-tt-zh">{t('pc.timeTravel')}</span>
          <span className="pc-tt-en">{t('pc.timeTravelEn')}</span>
        </button>
        <header className="pc-head">
          <span className="eyebrow">{t('pc.eyebrow')}</span>
          <h1>{placeName(place)}</h1>
          <p>{t('pc.intro')}</p>
        </header>
      </div>

      <div className="pc-wall">
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

      {nothingAtAll && <p className="pc-wall-empty">{t('pc.empty')}</p>}

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
