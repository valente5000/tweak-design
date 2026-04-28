// Scene 6: Export modal — modal rises, prompt scrolls, "copied to clipboard" toast.
// Window: 40 → 48s

function Scene6Export() {
  const { time } = useTimeline();
  const t = time;
  const sceneStart = 40;
  const sceneEnd = 48;

  if (t < sceneStart - 0.3 || t > sceneEnd + 0.3) return null;
  const local = t - sceneStart;
  const dur = sceneEnd - sceneStart;

  const opacity = local < 0.5
    ? Easing.easeOutCubic(clamp(local / 0.5, 0, 1))
    : local > dur - 0.5
      ? 1 - Easing.easeInCubic(clamp((local - (dur - 0.5)) / 0.5, 0, 1))
      : 1;

  const clickAt = 1.2;
  const modalIn = clamp((local - clickAt) / 0.5, 0, 1);

  const SHOT_H = 1080 - 180;
  const shotScale = SHOT_H / 1080;

  // Cursor lives in the SHOT layer (uses 1920x1080 coords pre-scale)
  const cx = ease(local, [
    {t: 0,   v: 1500},
    {t: 1.0, v: 1730},
    {t: 1.2, v: 1730},
    {t: 2.5, v: 960},
  ]);
  const cy = ease(local, [
    {t: 0,   v: 700},
    {t: 1.0, v: 1020},
    {t: 1.2, v: 1020},
    {t: 2.5, v: 540},
  ]);
  const clicking = local > 1.15 && local < 1.4;

  // Toast / dim / modal live in the OUTER 1920x(1080-180) frame
  const toastIn = clamp((local - clickAt - 0.3) / 0.3, 0, 1);
  const toastOut = clamp((local - clickAt - 3.0) / 0.4, 0, 1);
  const toastOpacity = toastIn * (1 - toastOut);

  const scrollT = clamp((local - clickAt - 1.0) / 4.5, 0, 1);
  const scrollY = -380 * Easing.easeInOutCubic(scrollT);

  const btnHighlight = clamp((local - 0.8) / 0.3, 0, 1) * (1 - clamp((local - 1.4) / 0.3, 0, 1));

  const promptText = `# Design review feedback

_Project:_ Three Directions
_Generated:_ 2026-04-28T00:45Z

## Tweaks
- accent: #0A84FF → #F5A623
- mode: light → deep

## Annotations

### Pin #1 — Hero image
"Replace hero photo with editorial portrait."

### Quadrant #2 — Byline
"Remove the 'by' prefix."

### Quadrant #3 — Section spacing
"Tighten gap between blocks (-24px)."

### Quadrant #4 — Image grid
"All images 4:3, equal heights."

## Apply to

- C Keynote (focused)
- shared/tokens.css
- src/components/Hero.tsx`;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, background: '#000' }}>
      {/* Background screenshot region (scaled down) */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 1920, height: SHOT_H,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, width: 1920, height: 1080,
          transform: `scale(${shotScale})`, transformOrigin: '0 0',
        }}>
          <img src="shots/04-annotations.webp" alt=""
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover',
              filter: `brightness(${1 - 0.55 * modalIn})`,
            }}/>

          {/* Export prompt button highlight */}
          <div style={{
            position: 'absolute',
            left: 1685, top: 1010,
            width: 116, height: 38,
            border: `2px solid ${TD_COLORS.accent}`,
            borderRadius: 6,
            opacity: btnHighlight,
            boxShadow: '0 0 24px rgba(245,166,35,0.6)',
          }}/>

          <Cursor x={cx} y={cy} clicking={clicking}/>
        </div>

        {/* Backdrop dim — covers the full SHOT region (not scaled) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          opacity: modalIn,
          pointerEvents: 'none',
        }}/>

        {/* Modal — positioned within the visible SHOT region, full-scale */}
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: `translate(-50%, calc(-50% + ${(1 - modalIn) * 40}px))`,
          opacity: modalIn,
          width: 920,
          height: 660,
          background: '#1a1a1d',
          border: `1px solid ${TD_COLORS.borderStrong}`,
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          fontFamily: TD_FONTS.sans,
        }}>
          <div style={{
            padding: '22px 32px',
            borderBottom: `1px solid ${TD_COLORS.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ color: TD_COLORS.ink, fontSize: 22, fontWeight: 600 }}>
              Export prompt
            </div>
            <div style={{ color: TD_COLORS.inkDim, fontSize: 24 }}>×</div>
          </div>
          <div style={{
            padding: '14px 32px',
            color: TD_COLORS.inkSoft,
            fontSize: 13,
            borderBottom: `1px solid ${TD_COLORS.border}`,
          }}>
            Paste into your Claude Code or Codex conversation.
          </div>
          <div style={{
            margin: 24,
            height: 470,
            overflow: 'hidden',
            background: '#0e0e10',
            borderRadius: 8,
            border: `1px solid ${TD_COLORS.border}`,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: 24 + scrollY,
              left: 28, right: 28,
              fontFamily: TD_FONTS.mono,
              fontSize: 13,
              lineHeight: 1.7,
              color: TD_COLORS.ink,
              whiteSpace: 'pre',
            }}>{promptText}</div>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 40,
              background: 'linear-gradient(to bottom, #0e0e10, transparent)',
              pointerEvents: 'none',
            }}/>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
              background: 'linear-gradient(to top, #0e0e10, transparent)',
              pointerEvents: 'none',
            }}/>
          </div>
        </div>

        {/* Toast */}
        <div style={{
          position: 'absolute',
          left: '50%', bottom: 60,
          transform: `translate(-50%, ${(1 - toastOpacity) * 20}px)`,
          opacity: toastOpacity,
          background: TD_COLORS.accent,
          color: TD_COLORS.accentInk,
          padding: '14px 24px',
          borderRadius: 8,
          fontFamily: TD_FONTS.mono,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 12px 40px rgba(245,166,35,0.4)',
        }}>
          <span style={{ fontSize: 16 }}>✓</span>
          Copied to clipboard
        </div>
      </div>

      <Sprite start={sceneStart + 0.4} end={sceneStart + 7.6}>
        <CaptionBar
          text={"Export a structured prompt."}
          sub="05 / Handoff"
          height={180}
        />
      </Sprite>
    </div>
  );
}

window.Scene6Export = Scene6Export;
