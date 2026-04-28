// Common helpers and styling primitives for the tweak-design video.
// Shared types: Cursor, Caption, Vignette, framing.

const TD_COLORS = {
  bg: '#0b0b0d',
  panel: '#141416',
  panelSoft: '#1a1a1d',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  ink: '#f5f5f7',
  inkSoft: 'rgba(245,245,247,0.62)',
  inkDim: 'rgba(245,245,247,0.38)',
  accent: '#f5a623', // tweak-design orange/yellow
  accentInk: '#1a1a1d',
  red: '#e84c3d',
  green: '#4dff70',
  blue: '#6a84ff',
};

const TD_FONTS = {
  // editorial pairing
  serif: '"GT Sectra", "Playfair Display", "Source Serif Pro", Georgia, serif',
  sans: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
};

// Animated cursor — renders an arrow at (x,y).
function Cursor({ x, y, label, clicking = false, scale = 1, opacity = 1 }) {
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      transform: `translate(-4px, -2px) scale(${scale})`,
      transformOrigin: '4px 2px',
      pointerEvents: 'none',
      zIndex: 9999,
      opacity,
      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
    }}>
      <svg width="22" height="28" viewBox="0 0 22 28" style={{display:'block'}}>
        <path d="M2 2 L2 22 L7 17 L10 24 L13 23 L10 16 L17 16 Z"
          fill="#ffffff" stroke="#0a0a0a" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
      {clicking && (
        <div style={{
          position: 'absolute',
          left: -10, top: -10,
          width: 30, height: 30,
          borderRadius: '50%',
          background: 'rgba(245,166,35,0.35)',
          animation: 'tdClickPulse 0.4s ease-out',
        }}/>
      )}
      {label && (
        <div style={{
          position: 'absolute',
          left: 24, top: 22,
          background: '#1a1a1d',
          color: TD_COLORS.ink,
          padding: '4px 8px',
          borderRadius: 4,
          fontFamily: TD_FONTS.mono,
          fontSize: 11,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>{label}</div>
      )}
    </div>
  );
}

// CaptionBar — black letterbox strip at the bottom that holds the editorial
// caption. Slides up into frame and pushes the artboard up slightly so the
// caption never sits ON the screenshot. position 'top' renders at the top.
function CaptionBar({ text, sub, side = 'bottom', height = 180 }) {
  const { localTime, duration } = useSprite();
  const entryDur = 0.55;
  const exitDur = 0.5;
  const exitStart = Math.max(0, duration - exitDur);

  let p = 1; // panel reveal 0..1
  if (localTime < entryDur) {
    p = Easing.easeOutCubic(clamp(localTime / entryDur, 0, 1));
  } else if (localTime > exitStart) {
    p = 1 - Easing.easeInCubic(clamp((localTime - exitStart) / exitDur, 0, 1));
  }

  // Slide bar in from offscreen
  const ty = (1 - p) * height * (side === 'bottom' ? 1 : -1);

  // Text reveal slightly delayed
  const textT = clamp((localTime - 0.25) / 0.5, 0, 1);
  const textTy = (1 - textT) * 8;

  const barStyle = {
    position: 'absolute',
    left: 0, right: 0,
    height,
    background: '#000',
    borderTop: side === 'bottom' ? `1px solid rgba(255,255,255,0.06)` : 'none',
    borderBottom: side === 'top' ? `1px solid rgba(255,255,255,0.06)` : 'none',
    transform: `translateY(${ty}px)`,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    padding: '0 96px',
    gap: 64,
  };
  if (side === 'bottom') barStyle.bottom = 0;
  else barStyle.top = 0;

  return (
    <div style={barStyle}>
      {/* Numbered eyebrow */}
      {sub && (
        <div style={{
          fontFamily: TD_FONTS.mono,
          fontSize: 14,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: TD_COLORS.accent,
          opacity: textT,
          transform: `translateY(${textTy}px)`,
          flexShrink: 0,
          width: 200,
          borderLeft: `1px solid ${TD_COLORS.accent}`,
          paddingLeft: 18,
        }}>{sub}</div>
      )}
      {/* Headline */}
      <div style={{
        fontFamily: TD_FONTS.serif,
        fontWeight: 400,
        fontSize: 48,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        color: TD_COLORS.ink,
        textWrap: 'pretty',
        opacity: textT,
        transform: `translateY(${textTy}px)`,
        flex: 1,
        maxWidth: 1300,
      }}>
        {text}
      </div>
    </div>
  );
}

// Legacy alias
const Caption = CaptionBar;

// Vignette overlay
function Vignette({ strength = 0.5 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none',
      background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${strength}) 100%)`,
    }}/>
  );
}

// Letterbox bars (for cinematic feel)
function Letterbox({ height = 80, opacity = 1 }) {
  return (
    <>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height,
        background: '#000', opacity, zIndex: 100,
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height,
        background: '#000', opacity, zIndex: 100,
      }}/>
    </>
  );
}

// Camera transform wrapper — applies pan/zoom to children.
function Camera({ x = 0, y = 0, scale = 1, children, transitionMs = 0 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: `scale(${scale}) translate(${-x}px, ${-y}px)`,
      transformOrigin: '0 0',
      transition: transitionMs > 0 ? `transform ${transitionMs}ms cubic-bezier(0.65, 0, 0.35, 1)` : 'none',
    }}>
      {children}
    </div>
  );
}

// Zoom helper — given (sourceX, sourceY, sourceW) of a region in a 1920x1080 frame,
// returns the camera transform that fits that region to fill the frame.
function zoomTo(sourceX, sourceY, sourceW, frameW = 1920, frameH = 1080) {
  const scale = frameW / sourceW;
  const sourceH = frameH / scale;
  return {
    x: sourceX,
    y: sourceY - (sourceH - sourceH) / 2,
    scale,
  };
}

// Damped tween — interpolate(t, [in], [out], easing) but supports arrays of values.
// Convenience for camera moves.
function ease(t, kf) {
  // kf = [{t, v}, ...]
  if (t <= kf[0].t) return kf[0].v;
  if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].v;
  for (let i = 0; i < kf.length - 1; i++) {
    if (t >= kf[i].t && t <= kf[i + 1].t) {
      const span = kf[i + 1].t - kf[i].t;
      const local = span === 0 ? 0 : (t - kf[i].t) / span;
      const e = Easing.easeInOutCubic(local);
      return kf[i].v + (kf[i + 1].v - kf[i].v) * e;
    }
  }
  return kf[kf.length - 1].v;
}

Object.assign(window, {
  TD_COLORS, TD_FONTS,
  Cursor, Caption, CaptionBar, Vignette, Letterbox, Camera,
  zoomTo, ease,
});
