import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n.js';

// Records an optional contributor sample. No clone or network upload occurs.
//
// States: idle → recording → recorded (preview / re-record / confirm) → confirmed.
export default function VoiceSampleRecorder({ sentence, onRecorded }) {
  const [status, setStatus] = useState('idle'); // idle | recording | recorded | confirmed
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState('');
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const supportedMime = () => {
    if (typeof MediaRecorder === 'undefined') return null;
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return types.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const start = async () => {
    setError('');
    const mime = supportedMime();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t('story.micUnavailable'));
      return;
    }
    try {
      setStatus('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());
        if (!mountedRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' });
        if (!blob.size) { setError(t('story.micDenied')); setStatus('idle'); return; }
        const reader = new FileReader();
        reader.onload = () => { if (mountedRef.current) { setAudioUrl(reader.result); setStatus('recorded'); } };
        reader.onerror = () => { if (mountedRef.current) { setError(t('story.micDenied')); setStatus('idle'); } };
        reader.readAsDataURL(blob);
      };
      setSeconds(0);
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 1; setSeconds(elapsed);
        if (elapsed >= 60 && recorder.state === 'recording') recorder.stop();
      }, 1000);
      recorder.start();
      setStatus('recording');
    } catch {
      stopTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (mountedRef.current) { setError(t('story.micDenied')); setStatus('idle'); }
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const reset = () => {
    stop();
    stopTimer();
    setAudioUrl(null);
    setSeconds(0);
    setError('');
    setStatus('idle');
  };

  const confirm = async () => {
    setStatus('saving'); setError('');
    try {
      await onRecorded?.(audioUrl);
      if (mountedRef.current) setStatus('confirmed');
    } catch (err) {
      if (mountedRef.current) { setStatus('recorded'); setError(err.message); }
    }
  };

  return (
    <div className="voice-sample">
      <p className="voice-sample-sentence"><b>{t('story.sentence')}</b><span>{sentence}</span></p>
      {error && status !== 'idle' && <p className="form-error" role="alert">{error}</p>}
      {(status === 'requesting' || status === 'saving') && <p role="status">{t('comp.saving')}</p>}

      {status === 'idle' && (
        <div className="voice-sample-actions">
          <button type="button" className="primary" onClick={start}>{t('story.record')}</button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      )}

      {status === 'recording' && (
        <div className="voice-sample-actions">
          <span className="voice-sample-timer">● {t('story.recording', { s: seconds })}</span>
          <button type="button" className="secondary" onClick={stop}>{t('story.stop')}</button>
        </div>
      )}

      {status === 'recorded' && (
        <div className="voice-sample-actions">
          {audioUrl && <audio controls src={audioUrl} />}
          <div className="voice-sample-btns">
            <button type="button" className="secondary" onClick={reset}>{t('story.rerecord')}</button>
            <button type="button" className="primary" onClick={confirm}>{t('story.confirm')}</button>
          </div>
        </div>
      )}

      {status === 'confirmed' && (
        <p className="voice-sample-done">✓ {t('story.collected')}</p>
      )}
    </div>
  );
}
