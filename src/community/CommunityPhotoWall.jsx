import { useEffect, useMemo, useState } from 'react';
import { buildThenCards, comparisonPlaceForPost, placeDistrictId } from '../services/thenNowService.js';
import { localizeStory } from '../content/stories.js';
import { createNarrator } from '../services/ttsService.js';
import { findPostPlace } from '../data/locations.js';
import { districts, getDistrict, nearestDistrict, regionOfDistrict, regions } from '../data/districts.js';
import { getLanguage, placeName, t } from '../i18n.js';

const squash = (text) => String(text || '').toLowerCase().replace(/[\s·・()（）\-_,，.。&＆'’]/g, '');

// The community wall, one card per place: "then" (old stories — elders'
// accounts, archival posts, our reviewed heritage stories) beside "now" (new
// stories from visitors). Tap a card for the full then-and-now page.
export default function CommunityPhotoWall({ posts, onOpenPlace, onAddStory }) {
  const lang = getLanguage();
  // Two-level filter: an area (HK Island / Kowloon / NT / Islands), then one of its districts.
  const [region, setRegion] = useState('all');
  const [district, setDistrict] = useState('all');
  const [query, setQuery] = useState('');
  const [playingId, setPlayingId] = useState(null);

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
  const districtOf = (post) => placeDistrictId(findPostPlace(post)?.id) || post.districtId;
  // Every place gets a district from where it is, so filing never depends on
  // whether the poster happened to pick one.
  const districtOfPlace = (place, fallback) => {
    if (place.kind === 'district') return place.id;
    const known = placeDistrictId(place.id);
    if (known) return known;
    if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) return nearestDistrict(place)?.id || fallback || null;
    return fallback || null;
  };

  // Group everything by place: { place, districtId, then: [...], now: [...] }.
  const pairs = useMemo(() => {
    const byPlace = new Map();
    const entry = (place, districtId) => {
      if (!byPlace.has(place.id)) byPlace.set(place.id, { place, districtId, then: [], now: [], latest: '' });
      const item = byPlace.get(place.id);
      if (!item.districtId && districtId) item.districtId = districtId;
      return item;
    };
    for (const card of thenCards) entry(card.place, districtOfPlace(card.place, card.districtId)).then.push({ kind: 'story', card });
    for (const post of posts) {
      const place = comparisonPlaceForPost(post);
      const item = entry(place, districtOfPlace(place, districtOf(post)));
      if (post.era === 'ARCHIVAL') item.then.unshift({ kind: 'post', post });
      else item.now.push(post);
      const when = String(post.takenAt || post.createdAt || '');
      if (when > item.latest) item.latest = when;
    }
    for (const item of byPlace.values()) item.now.sort((a, b) => String(b.takenAt || b.createdAt).localeCompare(String(a.takenAt || a.createdAt)));
    // Places with both sides first, then the busiest, then the most recent.
    return [...byPlace.values()].sort((a, b) => (
      (Boolean(b.then.length && b.now.length) - Boolean(a.then.length && a.now.length))
      || (b.then.length + b.now.length) - (a.then.length + a.now.length)
      || b.latest.localeCompare(a.latest)
    ));
  }, [thenCards, posts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counts per area and district (only those with stories get a chip).
  const counts = useMemo(() => {
    const byDistrict = new Map();
    const byRegion = new Map();
    for (const p of pairs) {
      const d = p.districtId || 'other';
      byDistrict.set(d, (byDistrict.get(d) || 0) + 1);
      const r = regionOfDistrict(p.districtId)?.id || 'other';
      byRegion.set(r, (byRegion.get(r) || 0) + 1);
    }
    return { byDistrict, byRegion };
  }, [pairs]);
  const regionChips = regions.filter((r) => counts.byRegion.get(r.id));
  const districtChips = region === 'all' || region === 'other' ? [] : regions.find((r) => r.id === region).districts
    .filter((id) => counts.byDistrict.get(id)).map(getDistrict);
  const chooseRegion = (id) => { setRegion(id); setDistrict('all'); };

  const q = squash(query);
  const inArea = (p) => (region === 'all' || (region === 'other' ? !regionOfDistrict(p.districtId) : regionOfDistrict(p.districtId)?.id === region))
    && (district === 'all' || p.districtId === district);
  const shown = pairs.filter((p) => inArea(p)
    && (!q || squash(`${placeName(p.place)} ${p.place.nameEn || ''} ${p.place.nameZh || ''} ${p.place.nameZhHK || ''}`).includes(q)));

  const stopAll = () => { narrator.stop(); elderNarrator.stop(); };
  const playStory = (card, event) => {
    event.stopPropagation();
    const id = `${card.place.id}:${card.story.track}`;
    if (playingId === id) { stopAll(); setPlayingId(null); return; }
    stopAll();
    narrator.play(card.story, lang);
    setPlayingId(id);
  };
  const playElder = (post, event) => {
    event.stopPropagation();
    if (playingId === post.id) { stopAll(); setPlayingId(null); return; }
    stopAll();
    elderNarrator.playText(postText(post), lang);
    setPlayingId(post.id);
  };

  const renderThen = (pair) => {
    const first = pair.then[0];
    if (!first) {
      return <div className="pair-side then is-empty"><span className="pair-label">{t('wall.then')}</span><p>{t('wall.noOld')}</p>
        <button type="button" className="pair-add" onClick={(e) => { e.stopPropagation(); onAddStory?.(pair.place, 'ARCHIVAL'); }}>{t('wall.addOld')}</button></div>;
    }
    if (first.kind === 'story') {
      const { card } = first;
      const story = localizeStory(card.story, lang);
      const id = `${card.place.id}:${card.story.track}`;
      return <div className="pair-side then">
        <span className="pair-label">{t('wall.then')}</span>
        {card.image?.url && <img src={card.image.url} alt="" loading="lazy" />}
        <p>{story.title}</p>
        <button type="button" className="wall-listen" onClick={(e) => playStory(card, e)}>{playingId === id ? 'Ⅱ' : '▶'} {t('wall.listen')}</button>
      </div>;
    }
    const { post } = first;
    return <div className="pair-side then">
      <span className="pair-label">{t('wall.then')}</span>
      {post.image && <img className={`photo-style-${post.photoStyle || 'original'}`} src={post.image} alt="" loading="lazy" />}
      <p>{postText(post)}</p>
      <small>{postAuthor(post)}</small>
      <button type="button" className="wall-listen" onClick={(e) => playElder(post, e)}>{playingId === post.id ? 'Ⅱ' : '▶'} {t('post.elderListen')}</button>
    </div>;
  };

  const renderNow = (pair) => {
    const post = pair.now[0];
    if (!post) {
      return <div className="pair-side now is-empty"><span className="pair-label">{t('wall.now')}</span><p>{t('wall.noNew')}</p>
        <button type="button" className="pair-add" onClick={(e) => { e.stopPropagation(); onAddStory?.(pair.place, 'MODERN'); }}>{t('wall.addNew')}</button></div>;
    }
    return <div className="pair-side now">
      <span className="pair-label">{t('wall.now')}</span>
      {post.image && <img className={`photo-style-${post.photoStyle || 'original'}`} src={post.image} alt="" loading="lazy" />}
      <p>{postText(post)}</p>
      <small>{postAuthor(post)}</small>
    </div>;
  };

  return (
    <div className="community-wall">
      <div className="wall-search">
        <span>⌕</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('comm.searchPh')} aria-label={t('comm.searchPh')} />
        {query && <button type="button" onClick={() => setQuery('')} aria-label={t('common.close')}>×</button>}
      </div>
      <div className="wall-districts wall-regions">
        <button className={region === 'all' ? 'active' : ''} onClick={() => chooseRegion('all')}>{t('wall.districtAll')} <i>{pairs.length}</i></button>
        {regionChips.map((r) => <button key={r.id} className={region === r.id ? 'active' : ''} onClick={() => chooseRegion(r.id)}>{placeName(r)} <i>{counts.byRegion.get(r.id)}</i></button>)}
        {counts.byRegion.get('other') > 0 && <button className={region === 'other' ? 'active' : ''} onClick={() => chooseRegion('other')}>{t('wall.areaOther')} <i>{counts.byRegion.get('other')}</i></button>}
      </div>
      {districtChips.length > 1 && <div className="wall-districts wall-subdistricts">
        <button className={district === 'all' ? 'active' : ''} onClick={() => setDistrict('all')}>{t('wall.areaAllOf', { area: placeName(regions.find((r) => r.id === region)) })}</button>
        {districtChips.map((d) => <button key={d.id} className={district === d.id ? 'active' : ''} onClick={() => setDistrict(d.id)}>{placeName(d)} <i>{counts.byDistrict.get(d.id)}</i></button>)}
      </div>}

      {shown.length === 0 ? (
        <div className="wall-empty">
          <p>{q ? t('wall.searchNone') : t('wall.empty')}</p>
          <button type="button" className="secondary" onClick={() => onAddStory?.(null, 'MODERN')}>{t('wall.searchOnMap')}</button>
        </div>
      ) : shown.map((pair) => {
        const area = getDistrict(pair.districtId);
        return (
          <article className="pair-card" key={pair.place.id} onClick={() => onOpenPlace(pair.place)}>
            <header>
              <div><b>{placeName(pair.place) || t('loc.none')}</b>{area && pair.place.kind !== 'district' && <small>{placeName(area)}</small>}</div>
              <span>{t('wall.pairCounts', { then: pair.then.length, now: pair.now.length })}</span>
            </header>
            <div className="pair-body">{renderThen(pair)}{renderNow(pair)}</div>
            <footer>{t('wall.openPair')}</footer>
          </article>
        );
      })}
    </div>
  );
}
