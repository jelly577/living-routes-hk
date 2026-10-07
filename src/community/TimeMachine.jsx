import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadGoogleMaps } from '../map/loadGoogleMaps.js';
import { createNarrator } from '../services/ttsService.js';
import { getThenNowImages, getPlaceStories } from '../services/thenNowService.js';
import { generateNarration, narrationStory } from '../services/timeTravelService.js';
import { getPosts } from '../services/communityService.js';
import { localizeStory } from '../content/stories.js';
import { getLanguage, placeName, t } from '../i18n.js';
import DepthPhoto from './DepthPhoto.jsx';

const postText = (post, lang) => post.textI18n?.[lang] || post.text;
const postAuthor = (post, lang) => post.authorI18n?.[lang] || post.author;

// Full-screen "Time Travel": a 360° Street View of the place today, switchable
// (top-left) to the archival photo, with an auto-playing spoken narration that
// bridges the two eras. Old side falls back to the archival photo since Google's
// JS API does not expose historical (Time Machine) panoramas.
export default function TimeMachine({ place, onClose }) {
  const { past, now } = getThenNowImages(place?.id);
  const lang = getLanguage();
  const [era, setEra] = useState('new'); // 'new' | 'old'
  const [posts, setPosts] = useState([]);
  const [script, setScript] = useState(null); // { title, text, source }
  const [playing, setPlaying] = useState(false);
  const [streetFail, setStreetFail] = useState(false);
  const svRef = useRef(null);
  const streetElRef = useRef(null);

  const narrator = useMemo(() => createNarrator({
    onStateChange: (s) => setPlaying(s.state === 'loading' || s.state === 'playing'),
  }), []);
  useEffect(() => () => narrator.stop(), [narrator]);

  // 360° Street View for the "now" side. Initialised once; the parent renders
  // this component with key={place.id}, so each place gets a fresh panorama.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(async (gmaps) => {
        if (cancelled || !streetElRef.current) return;
        // Street View is its own library in the current Maps JS API.
        const { StreetViewPanorama } = await gmaps.importLibrary('streetView');
        if (cancelled) return;
        const sv = new StreetViewPanorama(streetElRef.current, {
          position: { lat: place.lat, lng: place.lng },
          pov: { heading: 0, pitch: 5 },
          zoom: 1,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          showRoadLabels: false,
          linksControl: true,
        });
        svRef.current = sv;
        setStreetFail(false);
      })
      .catch(() => { if (!cancelled) setStreetFail(true); });
    return () => { cancelled = true; };
  }, [place?.lat, place?.lng]);

  // Load the place's posts once, then generate + play the narration whenever
  // the era (or language / posts) changes.
  useEffect(() => {
    let cancelled = false;
    getPosts({ placeId: place?.id }).then((r) => { if (!cancelled) setPosts(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [place?.id]);

  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    narrator.stop();
    setScript(null);

    const stories = getPlaceStories(place.id).map((s) => ({ text: localizeStory(s, lang).text }));
    const archival = posts.filter((p) => p.era === 'ARCHIVAL').map((p) => ({ text: postText(p, lang), author: postAuthor(p, lang) }));
    const modern = posts.filter((p) => p.era !== 'ARCHIVAL').map((p) => ({ text: postText(p, lang), author: postAuthor(p, lang) }));

    const notes = era === 'old' ? [...stories, ...archival] : modern;
    const bridge = era === 'old'
      ? (modern[0]?.text || '')
      : (stories[0]?.text || archival[0]?.text || '');

    generateNarration({ place, era, language: lang, notes, bridge }).then((res) => {
      if (cancelled) return;
      setScript(res);
      narrator.play(narrationStory(place, res), lang);
    });

    return () => { cancelled = true; };
  }, [era, posts, lang, place, narrator]);

  const toggleEra = () => setEra((e) => (e === 'old' ? 'new' : 'old'));

  const hasPast = Boolean(past?.url);
  const hasNow = Boolean(now?.url);

  return createPortal(
    <div className="tm-door" role="dialog" aria-modal="true" aria-label={placeName(place)}>
      <div className="tm-stage">
        {/* "now": the 360° Street View. Kept mounted so the panorama isn't
            torn down, but hidden + forced below the photo overlay when the
            old side is shown (Google's canvas z-index would otherwise win). */}
        <div ref={streetElRef} className={`tm-street ${era === 'old' ? 'tm-street-hidden' : ''}`} />

        {/* "old": archival photo as a depth-parallax "3D photo" (also the fallback
            when Street View fails). DepthPhoto falls back to a plain Ken Burns
            image if WebGL or the depth map is unavailable. */}
        {(era === 'old' || (era === 'new' && streetFail)) && (
          <div className={`tm-photo ${era === 'old' ? 'is-old' : ''}`}>
            {era === 'old' && hasPast
              ? <DepthPhoto src={past.url} depth={past.depthUrl} alt={placeName(place)} className="tm-photo-img" />
              : hasNow
                ? <DepthPhoto src={now.url} depth={now.depthUrl} alt={placeName(place)} className="tm-photo-img" />
                : <div className="tm-photo-empty">{placeName(place)}</div>}
            <div className="tm-vignette" />
            {era === 'old' && past?.credit && <small className="tm-credit">© {past.credit}</small>}
          </div>
        )}

        {/* top-left era switch */}
        <button className={`tm-era-toggle ${era === 'old' ? 'is-old' : ''}`} onClick={toggleEra} aria-label={t('tm.switchEra')}>
          <span className={era === 'new' ? 'on' : ''}>{t('tm.now')}</span>
          <span className="sep">/</span>
          <span className={era === 'old' ? 'on' : ''}>{t('tm.then')}</span>
        </button>

        <button className="tm-close" onClick={onClose} aria-label={t('common.close')}>×</button>

        <header className="tm-head">
          <span className="eyebrow">{era === 'old' ? t('tm.thenEyebrow') : t('tm.nowEyebrow')}</span>
          <h1>{placeName(place)}</h1>
        </header>

        {script && (
          <div className="tm-caption">
            <b>{script.title}</b>
            <p>{script.text}</p>
            <button className="tm-replay" onClick={() => narrator.play(narrationStory(place, script), lang)}>
              {playing ? 'Ⅱ' : '▶'} {t('tm.replay')}
            </button>
          </div>
        )}

        <span className="tm-hint">{era === 'old' ? `◎ ${t('tm.parallaxHint')}` : `⟲ ${t('tm.rotateHint')}`}</span>
      </div>
    </div>,
    document.body,
  );
}
