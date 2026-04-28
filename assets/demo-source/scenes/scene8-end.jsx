// Scene 8: End card — wordmark + tagline + install command + repo URL.
// Window: 54 → 62s

function Scene8End() {
  const { time } = useTimeline();
  const t = time;
  const sceneStart = 54;
  const sceneEnd = 62;

  if (t < sceneStart - 0.3) return null;
  const local = t - sceneStart;

  const opacity = clamp(local / 0.6, 0, 1);

  // Cascading reveal
  const v1 = clamp((local - 0.0) / 0.6, 0, 1);
  const v2 = clamp((local - 0.5) / 0.6, 0, 1);
  const v3 = clamp((local - 1.1) / 0.6, 0, 1);
  const v4 = clamp((local - 1.7) / 0.6, 0, 1);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#000',
      opacity,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Glow behind */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 1200, height: 800,
        background: 'radial-gradient(ellipse at center, rgba(245,166,35,0.18) 0%, transparent 60%)',
        opacity: clamp(local / 1.0, 0, 1),
      }}/>

      <div style={{
        position: 'relative',
        textAlign: 'center',
        fontFamily: TD_FONTS.sans,
      }}>
        {/* Eyebrow */}
        <div style={{
          fontFamily: TD_FONTS.mono,
          fontSize: 14,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: TD_COLORS.accent,
          opacity: v1,
          transform: `translateY(${(1 - v1) * 8}px)`,
          marginBottom: 28,
        }}>
          A skill for Claude Code & Codex
        </div>

        {/* Wordmark */}
        <div style={{
          fontFamily: TD_FONTS.serif,
          fontSize: 168,
          fontWeight: 400,
          color: TD_COLORS.ink,
          letterSpacing: '-0.035em',
          lineHeight: 0.95,
          opacity: v2,
          transform: `translateY(${(1 - v2) * 14}px)`,
        }}>
          tweak-<span style={{ fontStyle: 'italic', color: TD_COLORS.accent }}>design</span>
        </div>

        {/* Tagline */}
        <div style={{
          marginTop: 32,
          fontFamily: TD_FONTS.serif,
          fontSize: 32,
          fontStyle: 'italic',
          color: TD_COLORS.inkSoft,
          letterSpacing: '-0.01em',
          opacity: v3,
          transform: `translateY(${(1 - v3) * 10}px)`,
        }}>
          The visual review step for vibe-coded layouts.
        </div>

        {/* Install row */}
        <div style={{
          marginTop: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
          opacity: v4,
          transform: `translateY(${(1 - v4) * 10}px)`,
        }}>
          <div style={{
            fontFamily: TD_FONTS.mono,
            fontSize: 20,
            color: TD_COLORS.ink,
            background: '#16161a',
            padding: '14px 24px',
            borderRadius: 8,
            border: `1px solid ${TD_COLORS.borderStrong}`,
          }}>
            <span style={{ color: TD_COLORS.accent, marginRight: 12 }}>$</span>
            git clone github.com/valente5000/tweak-design
          </div>
          <div style={{
            fontFamily: TD_FONTS.mono,
            fontSize: 16,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: TD_COLORS.accent,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            Install <span style={{ fontSize: 20 }}>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Scene8End = Scene8End;
