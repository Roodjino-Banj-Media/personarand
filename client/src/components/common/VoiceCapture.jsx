import { useEffect, useRef, useState } from 'react';

/**
 * Voice capture button — Web Speech API → text.
 *
 * The user clicks the mic, speaks, clicks again to stop. Final transcript
 * is appended to the parent's `value` via `onChange`. The component is
 * deliberately a sibling-of-textarea layout (small inline mic button)
 * rather than a takeover modal — the user is editing a field, voice is
 * just an alternate input mode.
 *
 * Why Web Speech API and not Whisper:
 *   - No additional API key required (this is a v1 — Whisper can land
 *     later as a server-side upload route for noisy environments).
 *   - Runs entirely in the browser, no audio leaves the device unless
 *     the browser vendor's recognition service is invoked (Chrome sends
 *     to Google, Safari uses on-device for short utterances).
 *   - Live partial transcript while speaking → strong UX feedback.
 *   - Free, fast, low-latency.
 *
 * Browser support: Chrome, Edge, Safari (recent). Firefox does not ship
 * SpeechRecognition. We feature-detect and hide the button entirely on
 * unsupported browsers — no broken UI, no loud error.
 *
 * Props:
 *   - value          (string)   current value of the parent's text field
 *   - onChange       (string⇒ø) called with the new value (current + transcript)
 *   - lang           (string)   BCP-47 tag, defaults to 'en-US'. Pass 'fr-FR'
 *                               for French dictation.
 *   - className      (string)   override for the wrapper
 *   - replace        (boolean)  if true, transcript REPLACES value rather than appending.
 *                               Default false.
 *   - placeholderHint (string)  small label shown beside the mic when idle
 */
export default function VoiceCapture({ value, onChange, lang = 'en-US', className = '', replace = false, placeholderHint = '' }) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  // Snapshot of the parent's value at start. We keep appending the
  // accumulated transcript onto this snapshot so users editing the field
  // mid-recording don't fight with the recognition stream.
  const baseValueRef = useRef('');
  const accumulatedRef = useRef('');

  useEffect(() => {
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSupported(!!SR);
  }, []);

  function start() {
    setError(null);
    setPartial('');
    accumulatedRef.current = '';
    baseValueRef.current = replace ? '' : (value || '');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    const r = new SR();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (event) => {
      let interim = '';
      // Walk results from `resultIndex` to handle the streaming case
      // where new chunks arrive without resending old ones.
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const text = res[0]?.transcript || '';
        if (res.isFinal) {
          accumulatedRef.current = `${accumulatedRef.current}${accumulatedRef.current ? ' ' : ''}${text.trim()}`;
        } else {
          interim += text;
        }
      }
      setPartial(interim.trim());
      // Push the running merged value to the parent so the user sees the
      // textarea fill in live. Includes both finalized chunks and the
      // current interim hypothesis.
      const base = baseValueRef.current;
      const sep = base && !base.endsWith('\n') && !base.endsWith(' ') ? ' ' : '';
      const merged = `${base}${sep}${accumulatedRef.current}${accumulatedRef.current && interim ? ' ' : ''}${interim}`.trimStart();
      onChange(merged);
    };

    r.onerror = (event) => {
      // Common errors: 'no-speech', 'not-allowed' (mic permission denied),
      // 'audio-capture' (no mic), 'network' (recognition service down).
      const code = event?.error || 'unknown';
      const msg = {
        'no-speech': 'No speech detected. Try again.',
        'not-allowed': 'Microphone access denied. Allow it in browser settings and retry.',
        'audio-capture': 'No microphone detected.',
        'network': 'Voice recognition service is unreachable. Try again in a moment.',
        'aborted': null, // user canceled — don't show
      }[code] ?? `Voice input error: ${code}`;
      if (msg) setError(msg);
      setRecording(false);
    };

    r.onend = () => {
      setRecording(false);
      // Commit the final accumulated transcript with no interim portion.
      const base = baseValueRef.current;
      const sep = base && !base.endsWith('\n') && !base.endsWith(' ') ? ' ' : '';
      const finalValue = `${base}${sep}${accumulatedRef.current}`.trim();
      onChange(finalValue);
      setPartial('');
    };

    try {
      r.start();
      recognitionRef.current = r;
      setRecording(true);
    } catch (e) {
      // Some browsers throw if start() is called too quickly after a stop.
      setError('Could not start voice input — please try again.');
    }
  }

  function stop() {
    const r = recognitionRef.current;
    if (r) {
      try { r.stop(); } catch { /* ignore */ }
    }
  }

  if (!supported) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={recording ? stop : start}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
          recording
            ? 'border-danger/60 bg-danger/10 text-danger animate-pulse'
            : 'border-border bg-card text-text-secondary hover:text-text-primary hover:border-primary/60'
        }`}
        aria-pressed={recording}
        title={recording ? 'Stop dictation' : 'Dictate with voice'}
      >
        <span aria-hidden>{recording ? '⏹' : '🎙'}</span>
        <span>{recording ? 'Stop' : 'Dictate'}</span>
      </button>
      {recording && partial && (
        <span className="text-[11px] text-text-secondary italic line-clamp-1 flex-1 min-w-0" title={partial}>
          {partial}…
        </span>
      )}
      {!recording && placeholderHint && (
        <span className="text-[11px] text-text-secondary">{placeholderHint}</span>
      )}
      {error && (
        <span className="text-[11px] text-warning">{error}</span>
      )}
    </div>
  );
}
