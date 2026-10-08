import { useEffect, useMemo, useRef, useState } from 'react';
import { buildThenCards, comparisonPlaceForPost, placeDistrictId } from '../services/thenNowService.js';
import { localizeStory } from '../content/stories.js';
import { createNarrator } from '../services/ttsService.js';
import { findPostPlace } from '../data/locations.js';
import { districts } from '../data/districts.js';
import { getLanguage, placeName, t } from '../i18n.js';

// The community "photo wall": one surface split by a draggable time seam into
// "then" (elders' stories + archival posts) and "now" (visitor posts).
export default function CommunityPhotoWall({ posts, onOpenPlace }) {
  const lang = getLanguage();
  const [district, setDistrict] = useState('all');
  const [ratio, setRatio] = useState(0.5); // share of the wall given to "then"
  const [playingId, setPlayingId] = useState(null);
  const bodyRef = useRef(null);

  const thenCards = useMemo(() => buildThenCards(), []);
  const narrator = useMemo(() => createNarrator({
    onStateChange: (s) => { if (s.state === 'ended' || s.state === 'idle') setPlayingId(null); },
  }), []);
  const elderNarrator = useMemo(() => createNarrator({
    voice: 'elder',
    onStateChange: (s) => { if (s.state === 'ended' || s.state === 'idle') setPlayingId(null); },
  }), []);
  useEffect(() => () => { narrator.stop(); elderNarrator.stop(); }, [narrator, elderNarrator]);

  const postText = (post) => post.textI18n?.[lang] || post.text;
  const postAuthor = (post) => post.authorI18n?.[lang] || post.author;
  const postPlaceName = (post) => {
    if (post.locationType === 'none') return t('loc.none');
    const place = findPostPlace(post);
    return place ? placeName(place) : post.place;
  };

  const inDistrict = (id) => district === 'all' || id === district;
  const districtOf = (post) => placeDistrictId(findPostPlace(post)?.id) || post.districtId;
  const archivalPosts = posts.filter((p) => p.era === 'ARCHIVAL');
  const modernPosts = posts.filter((p) => p.era !== 'ARCHIVAL');
  const thenStories = thenCards.filter((c) => inDistrict(c.districtId));
  const thenPosts = archivalPosts.filter((p) => inDistrict(districtOf(p)));
  const nowPosts = modernPosts.filter((p) => inDistrict(districtOf(p)));

  const chipDistricts = useMemo(() => {
    const ids = new Set();
    thenCards.forEach((c) => c.districtId && ids.add(c.districtId));
    posts.forEach((p) => districtOf(p) && ids.add(districtOf(p)));
    return districts.filter((d) => ids.has(d.id));
  }, [thenCards, posts]);

  const playStory = (card) => {
    const id = `${card.place.id}:${card.story.track}`;
    if (playingId === id) { narrator.stop(); setPlayingId(null); return; }
    elderNarrator.stop();
    narrator.play(card.story, lang);
    setPlayingId(id);
  };

  // Elder voice reading an elder's own archival post text (its real voice
  // sample stays local; playback is synthesised with the "elder" profile).
  const playPost = (post) => {
    if (playingId === post.id) { elderNarrator.stop(); setPlayingId(null); return; }
    narrator.stop();
    elderNarrator.playText(postText(post), lang);
    setPlayingId(post.id);
  };

  const startSeamDrag = (event) => {
    event.preventDefault();
    const move = (ev) => {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect || !rect.width) return;
      const x = (ev.clientX - rect.left) / rect.width;
      setRatio(Math.min(0.82, Math.max(0.18, x)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const renderStoryCard = (card) => {
    const story = localizeStory(card.story, lang);
    const id = `${card.place.id}:${card.story.track}`;
    return (
      <article className="wall-card story" key={id} onClick={() => onOpenPlace(card.place)}>
        <div className="wall-card-img">
          {card.image?.url ? <img src={card.image.url} alt={placeName(card.place)} loading="lazy" /> : <div className="wall-img-ph">{placeName(card.place)}</div>}
          <span className="wall-era then">{t('era.ARCHIVAL')}</span>
        </div>
        <div className="wall-card-copy">
          <small>⌖ {placeName(card.place)}</small>
          <p>{story.title}</p>
          <button type="button" className="wall-listen" onClick={(e) => { e.stopPropagation(); playStory(card); }}>
            {playingId === id ? 'Ⅱ' : '▶'} {t('wall.listen')}
          </button>
        </div>
      </article>
    );
  };

  const renderPostCard = (post, side) => (
    <article className="wall-card post" key={post.id}>
      <div className="wall-card-img">
        {post.image ? <img className={`photo-style-${post.photoStyle || 'original'}`} src={post.image} alt={postPlaceName(post)} loading="lazy" /> : <div className="wall-img-ph">{postPlaceName(post)}</div>}
        <span className={`wall-era ${side}`}>{t(`era.${post.era === 'ARCHIVAL' ? 'ARCHIVAL' : 'MODERN'}`)}</span>
      </div>
      <div className="wall-card-copy">
        <small>⌖ {postPlaceName(post)}</small>
        <p>{postText(post)}</p>
        <b>{postAuthor(post)}</b>
        <button type="button" className="wall-listen" onClick={() => onOpenPlace(comparisonPlaceForPost(post))}>{t('wall.compare')}</button>
        {post.era === 'ARCHIVAL' && (
          <button type="button" className="wall-listen" onClick={() => playPost(post)}>
            {playingId === post.id ? 'Ⅱ' : '▶'} {t('post.elderListen')}
          </button>
        )}
      </div>
    </article>
  );

  const nothingAtAll = thenStories.length === 0 && thenPosts.length === 0 && nowPosts.length === 0;

  return (
    <div className="community-wall">
      <div className="wall-districts">
        <button className={district === 'all' ? 'active' : ''} onClick={() => setDistrict('all')}>{t('wall.districtAll')}</button>
        {chipDistricts.map((d) => <button key={d.id} className={district === d.id ? 'active' : ''} onClick={() => setDistrict(d.id)}>{placeName(d)}</button>)}
      </div>

      {nothingAtAll ? (
        <p className="wall-empty">{t('wall.empty')}</p>
      ) : (
        <div className="wall-body" ref={bodyRef}>
          <section className="wall-col then" style={{ flexGrow: ratio }}>
            <header className="wall-col-head"><b>{t('wall.then')}</b><small>{t('wall.thenSub')}</small></header>
            {thenPosts.map((post) => renderPostCard(post, 'then'))}
            {thenStories.map(renderStoryCard)}
            {thenStories.length === 0 && thenPosts.length === 0 && <p className="wall-col-empty">{t('wall.thenEmpty')}</p>}
          </section>

          <div className="wall-seam" onPointerDown={startSeamDrag} title={t('wall.seamHint')} role="separator" aria-orientation="vertical">
            <span />
          </div>

          <section className="wall-col now" style={{ flexGrow: 1 - ratio }}>
            <header className="wall-col-head"><b>{t('wall.now')}</b><small>{t('wall.nowSub')}</small></header>
            {nowPosts.map((post) => renderPostCard(post, 'now'))}
            {nowPosts.length === 0 && <p className="wall-col-empty">{t('wall.nowEmpty')}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
