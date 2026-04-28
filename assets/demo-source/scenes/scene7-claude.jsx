// Scene 7: Paste into Claude Code — terminal where the prompt appears
// and Claude starts editing files.
// Window: 48 → 54s

function Scene7Claude() {
  const { time } = useTimeline();
  const t = time;
  const sceneStart = 48;
  const sceneEnd = 54;

  if (t < sceneStart - 0.3 || t > sceneEnd + 0.3) return null;
  const local = t - sceneStart;
  const dur = sceneEnd - sceneStart;

  const opacity = local < 0.5
    ? Easing.easeOutCubic(clamp(local / 0.5, 0, 1))
    : local > dur - 0.5
      ? 1 - Easing.easeInCubic(clamp((local - (dur - 0.5)) / 0.5, 0, 1))
      : 1;

  // Lines reveal sequentially
  const lines = [
    { at: 0.4, text: '> Pasted design feedback (12 items, 4 annotations).', color: TD_COLORS.inkSoft },
    { at: 1.0, text: '⏺ Read tokens.css', color: TD_COLORS.ink },
    { at: 1.6, text: '⏺ Read src/components/Hero.tsx', color: TD_COLORS.ink },
    { at: 2.2, text: '⏺ Edit tokens.css   --accent: #F5A623', color: TD_COLORS.green },
    { at: 2.8, text: '⏺ Edit Hero.tsx     replace hero image src', color: TD_COLORS.green },
    { at: 3.4, text: '⏺ Edit Layout.tsx   gap-y: 24 → 16', color: TD_COLORS.green },
    { at: 4.0, text: '⏺ Edit ImageGrid.tsx aspect-ratio: 4 / 3', color: TD_COLORS.green },
    { at: 4.6, text: '✓ 4 files changed, 28 insertions, 14 deletions', color: TD_COLORS.accent },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, background: '#0a0a0c' }}>
      {/* Subtle grid bg */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}/>

      {/* Terminal frame */}
      <div style={{
        position: 'absolute',
        left: 200, top: 110,
        width: 1520, height: 720,
        background: '#101013',
        border: `1px solid ${TD_COLORS.border}`,
        borderRadius: 12,
        boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        fontFamily: TD_FONTS.mono,
      }}>
        {/* Title bar */}
        <div style={{
          padding: '14px 20px',
          background: '#16161a',
          borderBottom: `1px solid ${TD_COLORS.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }}/>
            ))}
          </div>
          <div style={{
            color: TD_COLORS.inkSoft,
            fontSize: 12,
            marginLeft: 12,
            letterSpacing: '0.04em',
          }}>claude-code · ~/projects/three-directions</div>
        </div>

        {/* Body */}
        <div style={{
          padding: '32px 40px',
          fontSize: 18,
          lineHeight: 1.7,
        }}>
          {lines.map((line, i) => {
            const v = clamp((local - line.at) / 0.3, 0, 1);
            return (
              <div key={i} style={{
                opacity: v,
                transform: `translateY(${(1 - v) * 6}px)`,
                color: line.color,
                marginBottom: 4,
                fontFamily: TD_FONTS.mono,
              }}>
                {line.text}
              </div>
            );
          })}

          {/* Blinking cursor at end */}
          {local > 5.0 && (
            <div style={{
              display: 'inline-block',
              width: 10, height: 22,
              background: TD_COLORS.accent,
              marginTop: 12,
              opacity: Math.floor(t * 2) % 2 === 0 ? 1 : 0,
            }}/>
          )}
        </div>
      </div>

      <Sprite start={sceneStart + 0.4} end={sceneStart + 5.5}>
        <CaptionBar
          text={"Paste. Iterate. Ship."}
          sub="06 / Round-trip"
          height={180}
        />
      </Sprite>
    </div>
  );
}

window.Scene7Claude = Scene7Claude;
