import { useState } from 'react';
import QuickCaptureModal from './QuickCaptureModal.jsx';

/**
 * Floating Action Button for quick capture.
 *
 * Mounts at the App root so it stays visible across navigation. Click →
 * modal opens with VoiceCapture autofocused; user dictates a thought,
 * Haiku classifies it, the user confirms a destination (Knowledge Base,
 * planned post, reactive seed, journal note) and the appropriate write
 * runs through the existing endpoints.
 *
 * Why a FAB and not a sidebar entry: the use case is "I had a thought,
 * I want to capture it RIGHT NOW from wherever I am" — that's exactly
 * what a fixed-position FAB is shaped for. Sidebar entries reward
 * planning; FABs reward impulse capture.
 *
 * Position: bottom-right with safe-area padding for mobile. The Sidebar
 * also lives along the left edge on lg+ so right-side is safe.
 */
export default function QuickCaptureFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-30 right-4 bottom-4 lg:right-6 lg:bottom-6 h-12 w-12 rounded-full bg-primary text-white shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all flex items-center justify-center text-xl active:scale-95"
        aria-label="Quick capture"
        title="Quick capture (dictate or type any thought)"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <span aria-hidden>🎙</span>
      </button>
      {open && (
        <QuickCaptureModal onClose={() => setOpen(false)} />
      )}
    </>
  );
}
