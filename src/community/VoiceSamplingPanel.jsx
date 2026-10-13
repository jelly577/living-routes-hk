import { useEffect, useState } from 'react';
import { t } from '../i18n.js';
import { getVoiceSample, saveVoiceSample, removeVoiceSample } from '../services/voiceSampleService.js';
import VoiceSampleRecorder from './VoiceSampleRecorder.jsx';

export default function VoiceSamplingPanel({ name = '' }) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sample, setSample] = useState(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    getVoiceSample().then((value) => { if (!cancelled) setSample(value); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const save = async (audio) => {
    setBusy(true); setError('');
    try { setSample(await saveVoiceSample({ audio, name, consent })); setRecording(false); }
    catch (err) { setError(err.message); throw err; }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(t('sampling.deleteConfirm'))) return;
    setBusy(true); setError('');
    try { await removeVoiceSample(); setSample(null); setConsent(false); setRecording(false); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="voice-sampling-panel" aria-labelledby="voice-sampling-title">
    <h2 id="voice-sampling-title">{t('sampling.title')}</h2>
    <p>{t('sampling.intro')}</p>
    <button type="button" className="secondary" aria-expanded={open} aria-controls="voice-sampling-content" disabled={busy} onClick={() => {
      setOpen(!open); if (open) { setRecording(false); setConsent(false); }
    }}>{t(open ? 'sampling.close' : 'sampling.open')}</button>
    {open && <div id="voice-sampling-content">
      <p className="location-note">{t('sampling.privacy')}</p>
      <p className="voice-sampling-status">{t('sampling.planned')}</p>
      {sample && <div className="voice-sampling-preview">
        <p role="status">{t('sampling.saved')}</p>
        <audio controls src={sample.audio} aria-label={t('sampling.preview')} />
        <button type="button" className="secondary" disabled={busy} onClick={remove}>{t('sampling.delete')}</button>
      </div>}
      <label className="consent-row"><input type="checkbox" checked={consent} disabled={busy || loading} onChange={(event) => {
        setConsent(event.target.checked); if (!event.target.checked) setRecording(false);
      }} />{t('sampling.consent')}</label>
      {consent && !recording && <button type="button" className="primary" disabled={busy || loading} onClick={() => setRecording(true)}>{t(sample ? 'sampling.replace' : 'story.recordVoice')}</button>}
      {consent && recording && <VoiceSampleRecorder sentence={t('sampling.sentence')} onRecorded={save} />}
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>}
  </section>;
}
