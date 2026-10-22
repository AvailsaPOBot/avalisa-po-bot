import { useEffect, useRef, useState } from 'react';

const CELLS = [
  ['Mode', 'Martingale'],
  ['Step cap', '3'],
  ['Min payout', '80%'],
  ['Demo', '10 left'],
];
const HUD_LINE = 'MARTINGALE · STEP CAP 3 · MIN PAYOUT 80% · DEMO 10 LEFT';

// WebGL only where it pays off: a desktop-sized window, motion allowed, and enough cores.
function wantsWebGL() {
  if (typeof window === 'undefined' || !window.WebGLRenderingContext) return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false;
  if (window.innerWidth < 768) return false;
  if ((navigator.hardwareConcurrency || 8) <= 4) return false;
  return true;
}

/** Static glass slab: the phone, reduced-motion and low-power version, and the pre-WebGL placeholder. */
function CssSlab() {
  return (
    <div className="v3-cslab" aria-hidden="true">
      <div className="v3-cslab__face">
        <div className="v3-cslab__head"><span><i className="v3-dot" /> Ready on Demo</span><span>Avalisa · Rule panel</span></div>
        <div className="v3-cslab__grid">
          {CELLS.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}
        </div>
        <div className="v3-cslab__line">{HUD_LINE}</div>
      </div>
    </div>
  );
}

export default function HeroSlab() {
  const hostRef = useRef(null);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    if (!wantsWebGL() || !hostRef.current) return undefined;
    const host = hostRef.current;
    let cancelled = false;
    let dispose = null;
    let idleId = 0;
    let timeoutId = 0;
    const start = async () => {
      try {
        const { mountSlab } = await import('./slabScene.js');
        if (cancelled) return;
        const stop = await mountSlab(host, { onReady: () => { if (!cancelled) setWebglReady(true); } });
        if (cancelled) stop(); else dispose = stop;
      } catch {
        // No WebGL: the CSS slab simply stays.
      }
    };
    // After first paint, when the main thread is idle.
    const frame = requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(start, { timeout: 2500 });
      else timeoutId = window.setTimeout(start, 400);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (idleId) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
      dispose?.();
    };
  }, []);

  return (
    <div
      className={`v3-slab${webglReady ? ' is-webgl' : ''}`}
      role="img"
      aria-label="Avalisa rule panel: Martingale, step cap 3, minimum payout 80%, 10 Demo trades left"
    >
      <div className="v3-slab__gl" ref={hostRef} />
      <CssSlab />
    </div>
  );
}
