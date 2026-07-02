import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

// iOS 13+ iPads report as 'MacIntel' with touch support instead of 'iPad'.
function isIPad(): boolean {
  return (
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function getIsMobile(): boolean {
  if (isIPad()) {
    // __satplexIsLandscape is set by Swift before it fires the resize event,
    // so it's always the correct value when this function runs after rotation.
    const nativeLandscape = (window as unknown as { __satplexIsLandscape?: boolean }).__satplexIsLandscape;
    if (typeof nativeLandscape === 'boolean') {
      return !nativeLandscape;
    }
    // Fallback for browser-based testing (no Swift bridge present).
    // Use both matchMedia and dimension ratio so either one is enough to detect landscape.
    const isLandscape =
      window.matchMedia('(orientation: landscape)').matches ||
      window.innerWidth > window.innerHeight;
    return !isLandscape;
  }
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => getIsMobile());

  useEffect(() => {
    if (isIPad()) {
      // Re-check immediately on mount: WKWebView's dimensions may not be settled
      // at useState init time when the app launches directly into landscape mode.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with WKWebView's native geometry, not React state
      setIsMobile(getIsMobile());

      // WKWebView fires its own resize events during the rotation animation.
      // Swift sets __satplexRotating=true at the START of the animation and
      // __satplexRotating=false in the completion block, so we can safely
      // ignore any resize events that arrive before the animation finishes.
      const handler = () => {
        if ((window as unknown as { __satplexRotating?: boolean }).__satplexRotating === true) return;
        setIsMobile(getIsMobile());
      };
      window.addEventListener('resize', handler);
      return () => window.removeEventListener('resize', handler);
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
