import { useState, useCallback, useRef, useEffect } from 'react';

export type FontSize = 'normal' | 'large' | 'x-large';
export type AccessibilityMode = 'standard' | 'accessible';

interface AccessibilityState {
  mode: AccessibilityMode;
  fontSize: FontSize;
  highContrast: boolean;
  earcons: boolean;
  reducedMotion: boolean;
}

interface UseAccessibilityReturn extends AccessibilityState {
  toggleMode: () => void;
  setFontSize: (size: FontSize) => void;
  toggleHighContrast: () => void;
  toggleEarcons: () => void;
  toggleReducedMotion: () => void;
  playEarcon: (type: 'success' | 'error' | 'processing' | 'notification') => void;
  announce: (message: string) => void;
  fontSizeClass: string;
}

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  normal: 'text-sm',
  large: 'text-base',
  'x-large': 'text-lg',
};

// Store preferences in localStorage
const STORAGE_KEY = 'aria-accessibility-prefs';

function loadPrefs(): Partial<AccessibilityState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePrefs(state: AccessibilityState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silent fail
  }
}

export function useAccessibility(): UseAccessibilityReturn {
  const storedPrefs = loadPrefs();

  const [mode, setMode] = useState<AccessibilityMode>(storedPrefs.mode || 'standard');
  const [fontSize, setFontSizeState] = useState<FontSize>(storedPrefs.fontSize || 'normal');
  const [highContrast, setHighContrast] = useState(storedPrefs.highContrast ?? false);
  const [earcons, setEarcons] = useState(storedPrefs.earcons ?? true);
  const [reducedMotion, setReducedMotion] = useState(storedPrefs.reducedMotion ?? false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const announceRef = useRef<HTMLDivElement | null>(null);

  // Persist preferences
  useEffect(() => {
    savePrefs({ mode, fontSize, highContrast, earcons, reducedMotion });
  }, [mode, fontSize, highContrast, earcons, reducedMotion]);

  // Set up ARIA live region for announcements
  useEffect(() => {
    if (!announceRef.current) {
      const el = document.createElement('div');
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.className = 'sr-only';
      el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
      document.body.appendChild(el);
      announceRef.current = el;
    }
    return () => {
      if (announceRef.current) {
        document.body.removeChild(announceRef.current);
        announceRef.current = null;
      }
    };
  }, []);

  // Apply high contrast and reduced motion to document
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    document.documentElement.classList.toggle('accessible-mode', mode === 'accessible');
  }, [highContrast, reducedMotion, mode]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playEarcon = useCallback((type: 'success' | 'error' | 'processing' | 'notification') => {
    if (!earcons) return;

    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, now);

    if (type === 'success') {
      // Rising two-tone: C5 → E5
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523, now);
      osc1.connect(gain);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659, now + 0.15);
      osc2.connect(gain);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.3);
      gain.gain.setValueAtTime(0, now + 0.3);
    } else if (type === 'error') {
      // Low descending tone: G3 → E3
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(196, now);
      osc.frequency.linearRampToValueAtTime(165, now + 0.3);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.3);
      gain.gain.setValueAtTime(0, now + 0.3);
    } else if (type === 'processing') {
      // Soft pulsing hum: A4
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'notification') {
      // Bright bell: E5 → G5 → E5
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659, now);
      osc.frequency.setValueAtTime(784, now + 0.1);
      osc.frequency.setValueAtTime(659, now + 0.2);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.3);
      gain.gain.setValueAtTime(0, now + 0.3);
    }
  }, [earcons, getAudioContext]);

  const announce = useCallback((message: string) => {
    if (announceRef.current) {
      announceRef.current.textContent = '';
      // Small delay to ensure screen readers pick up the change
      setTimeout(() => {
        if (announceRef.current) {
          announceRef.current.textContent = message;
        }
      }, 50);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(prev => {
      const next = prev === 'standard' ? 'accessible' : 'standard';
      return next;
    });
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrast(prev => !prev);
  }, []);

  const toggleEarcons = useCallback(() => {
    setEarcons(prev => !prev);
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setReducedMotion(prev => !prev);
  }, []);

  return {
    mode,
    fontSize,
    highContrast,
    earcons,
    reducedMotion,
    toggleMode,
    setFontSize,
    toggleHighContrast,
    toggleEarcons,
    toggleReducedMotion,
    playEarcon,
    announce,
    fontSizeClass: FONT_SIZE_CLASSES[fontSize],
  };
}
