import { useEffect, useMemo, useRef, useState } from 'react';
import { getLanguage, t } from '../i18n.js';
import {
  MEMOIR_LANGUAGES, buildMemoirStops, generateMemoirScript, memoirDateBounds, memoirLabels,
} from '../services/memoirService.js';
import { requestMemoirAi, sharedCommunityEnabled } from '../services/sharedCommunityService.js';
import { buildNextRecommendation, deriveInterestSignals } from '../services/recommendationService.js';
import { createMemoirPlan, drawMemoirFrame, VIDEO_SIZE } from './memoirRenderer.js';
import { imageToJpegDataUrl, loadMemoirImages, pickVideoFormat, recordMemoir } from './memoirMedia.js';

const LANGUAGE_NAMES = { en: 'English', 'zh-HK': '繁體中文 · 粵語', 'zh-CN': '简体中文 · 普通话' };
const fmtTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

// Travel-memoir video from the user's own posts: pick dates → (optional AI
// captions) → preview on the map → edit captions → record and download.
export default function MemoirStudio({ memories }) {
  const bounds = useMemo(() => memoirDateBounds(memories), [memories]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [language, setLanguage] = useState(MEMOIR_LANGUAGES.includes(getLanguage()) ? getLanguage() : 'en');
  const [allowAi, setAllowAi] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null); // { stops, images, script, truncated }
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState(null);
  const canvasRef = useRef(null);
  const clockRef = useRef({ startedAt: 0, offset: 0 });

  useEffect(() => { setFrom(bounds.from); setTo(bounds.to); }, [bounds.from, bounds.to]);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);

  const selection = useMemo(() => buildMemoirStops(memories, { from, to }), [memories, from, to]);

  const plan = useMemo(() => (draft ? createMemoirPlan({
    stops: draft.stops, script: draft.script, images: draft.images, labels: memoirLabels(draft.script.language),
  }) : null), [draft]);

  // Preview playback (also redraws on scrub or caption edits).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!plan || !canvas || busy === 'recording') return undefined;
    const ctx = canvas.getContext('2d');
    if (!playing) { drawMemoirFrame(ctx, plan, time); return undefined; }
    let frame = 0;
    clockRef.current = { startedAt: performance.now(), offset: time >= plan.duration ? 0 : time };
    const tick = (now) => {
      const current = clockRef.current.offset + (now - clockRef.current.startedAt) / 1000;
      if (current >= plan.duration) { drawMemoirFrame(ctx, plan, plan.duration); setTime(plan.duration); setPlaying(false); return; }
      drawMemoirFrame(ctx, plan, current);
      setTime(current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `time` is read only when playback (re)starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, playing, busy]);
  useEffect(() => { if (plan && !playing && canvasRef.current) drawMemoirFrame(canvasRef.current.getContext('2d'), plan, time); }, [time, plan, playing]);

  const prepare = async () => {
    setError(''); setVideo(null); setPlaying(false); setTime(0);
    if (!selection.stops.length) { setError(t('memo.nothing')); return; }
    setBusy('preparing');
    try {
      await document.fonts?.ready;
      const images = await loadMemoirImages(selection.stops);
      const aiImages = allowAi
        ? Object.fromEntries(Object.entries(images).map(([id, image]) => [id, imageToJpegDataUrl(image)]).filter(([, url]) => url))
        : {};
      const script = await generateMemoirScript(selection.stops, {
        language, allowAi, images: aiImages, requestAi: sharedCommunityEnabled ? requestMemoirAi : null,
      });
      setDraft({ stops: selection.stops, images, script, truncated: selection.truncated, total: selection.totalAvailable });
      setPlaying(true);
    } catch (problem) {
      setError(problem.message || String(problem));
    } finally {
      setBusy('');
    }
  };

  const editCaption = (stopId, postId, caption) => {
    setVideo(null);
    setDraft((current) => ({
      ...current,
      script: {
        ...current.script,
        stops: current.script.stops.map((stop) => (stop.stopId !== stopId ? stop : {
          ...stop, memories: stop.memories.map((memory) => (memory.postId === postId ? { ...memory, caption } : memory)),
        })),
      },
    }));
  };
  const editTitle = (title) => { setVideo(null); setDraft((current) => ({ ...current, script: { ...current.script, title } })); };

  const exportVideo = async () => {
    if (!plan || !canvasRef.current) return;
    setError(''); setPlaying(false); setProgress(0); setBusy('recording');
    try {
      const result = await recordMemoir(canvasRef.current, plan, { onProgress: setProgress });
      const day = (draft.stops[0]?.day || 'memoir').replaceAll('-', '');
      setVideo({ url: URL.createObjectURL(result.blob), name: `living-routes-memoir-${day}.${result.extension}`, extension: result.extension, size: result.blob.size });
      setTime(plan.duration);
    } catch (problem) {
      setError(problem.message || String(problem));
    } finally {
      setBusy('');
    }
  };

  const notice = draft && {
    'no-consent': t('memo.srcOwn'),
    'not-configured': t('memo.srcNotConfigured'),
    'ai-failed': t('memo.srcFailed'),
  }[draft.script.fallbackReason];
  const signals = useMemo(() => (draft ? deriveInterestSignals(draft.stops.flatMap((stop) => stop.memories.map(({ post }) => post))) : []), [draft]);
  const recordable = Boolean(pickVideoFormat());

  return <section className="memoir-studio">
    <header>
      <span className="eyebrow">{t('memo.eyebrow')}</span>
      <h2>{t('memo.title')}</h2>
      <p>{t('memo.intro')}</p>
    </header>

    <div className="memoir-controls">
      <div className="memoir-dates">
        <label>{t('memo.from')}<input type="date" value={from} min={bounds.from} max={to || bounds.to} onChange={(event) => setFrom(event.target.value)}/></label>
        <label>{t('memo.to')}<input type="date" value={to} min={from || bounds.from} max={bounds.to} onChange={(event) => setTo(event.target.value)}/></label>
      </div>
      <label>{t('memo.language')}<select value={language} onChange={(event) => setLanguage(event.target.value)}>
        {MEMOIR_LANGUAGES.map((code) => <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>)}
      </select></label>
      <p className="memoir-count">{t('memo.count', { posts: selection.memoryCount, stops: selection.stops.length })}{selection.truncated ? ` ${t('memo.truncated', { n: selection.memoryCount })}` : ''}</p>
      <label className="consent-row memoir-consent"><input type="checkbox" checked={allowAi} onChange={(event) => setAllowAi(event.target.checked)}/><span>{t('memo.aiConsent')}</span></label>
      <button type="button" className="generate-button" disabled={Boolean(busy) || !selection.stops.length} onClick={prepare}>
        ✦ {busy === 'preparing' ? t(allowAi ? 'memo.preparingAi' : 'memo.preparing') : t(draft ? 'memo.regenerate' : 'memo.generate')}
      </button>
      {error && <p className="memoir-error" role="alert">{error}</p>}
    </div>

    {draft && plan && <div className="memoir-result page-enter">
      {notice && <p className="memoir-notice">{notice}</p>}
      <div className="memoir-stage">
        <canvas ref={canvasRef} width={VIDEO_SIZE.width} height={VIDEO_SIZE.height} aria-label={t('memo.previewLabel')}/>
      </div>
      {busy === 'recording'
        ? <div className="memoir-recording" role="status"><div><i style={{ width: `${Math.round(progress * 100)}%` }}/></div><span>{t('memo.recording', { p: Math.round(progress * 100) })}</span></div>
        : <div className="memoir-transport">
          <button type="button" className="secondary" onClick={() => { if (time >= plan.duration) setTime(0); setPlaying((value) => !value); }}>{playing ? '❚❚' : '▶'}</button>
          <input type="range" min="0" max={plan.duration} step="0.05" value={Math.min(time, plan.duration)} aria-label={t('memo.scrub')} onChange={(event) => { setPlaying(false); setTime(Number(event.target.value)); }}/>
          <small>{fmtTime(time)} / {fmtTime(plan.duration)}</small>
        </div>}

      <button type="button" className="primary wide" disabled={Boolean(busy) || !recordable} onClick={exportVideo}>{t('memo.export')}<span>↓</span></button>
      <p className="memoir-hint">{recordable ? t('memo.exportHint', { s: Math.round(plan.duration) }) : t('memo.noRecorder')}</p>
      {video && <div className="memoir-video page-enter">
        <video src={video.url} controls playsInline/>
        <a className="secondary wide" href={video.url} download={video.name}>{t('memo.download', { ext: video.extension.toUpperCase(), mb: (video.size / 1e6).toFixed(1) })}</a>
        {video.extension !== 'mp4' && <small>{t('memo.webmNote')}</small>}
      </div>}

      <div className="memoir-script">
        <span className="eyebrow">{t('memo.scriptEyebrow')}</span>
        <label>{t('memo.videoTitle')}<input value={draft.script.title} maxLength={40} onChange={(event) => editTitle(event.target.value)}/></label>
        {draft.script.stops.map((stop, index) => {
          const memoirStop = draft.stops[index];
          return <div className="memoir-stop" key={stop.stopId}>
            <b><i>{String(index + 1).padStart(2, '0')}</i>{stop.title}<small>{memoirStop.day?.replaceAll('-', '.')}</small></b>
            {stop.memories.map((memory) => {
              const post = memoirStop.memories.find((item) => item.post.id === memory.postId)?.post;
              return <label key={memory.postId} className="memoir-caption">
                {post?.image ? <img src={post.image} alt=""/> : <span className="memory-placeholder">✎</span>}
                <textarea value={memory.caption} maxLength={160} aria-label={t('memo.captionLabel')} onChange={(event) => editCaption(stop.stopId, memory.postId, event.target.value)}/>
              </label>;
            })}
          </div>;
        })}
        {draft.truncated && <small>{t('memo.truncated', { n: draft.stops.reduce((n, stop) => n + stop.memories.length, 0) })}</small>}
      </div>

      <div className="profile-update memoir-profile"><small>{t('jr.learned')}</small><b>{signals.map((signal) => signal.label).join(' · ')}</b><p>{t('jr.nextRec', { x: buildNextRecommendation(signals).label })}</p></div>
    </div>}
  </section>;
}
