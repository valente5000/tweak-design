// Scene 1: Cold open — terminal types `claude skill add tweak-design`,
// then a wordmark + tagline reveal.
// Window: 0 → 5s

function Scene1Open() {
  const { time } = useTimeline();
  const t = time; // global

  // Terminal types between 0.4 and 2.6s
  const cmd = "npx skills add valente5000/tweak-design";
  const typeStart = 0.4;
  const typeEnd = 2.4;
  const typedChars = clamp(((t - typeStart) / (typeEnd - typeStart)) * cmd.length, 0, cmd.length);
  const visibleCmd = cmd.slice(0, Math.floor(typedChars));

  // Caret blink
  const caretOn = Math.floor(t * 2) % 2 === 0;

  // Wordmark fades in 2.9 → 3.5s; whole scene fades out 4.5 → 5
  const wordmarkOpacity = clamp((t - 2.9) / 0.6, 0, 1);
  const taglineOpacity = clamp((t - 3.3) / 0.6, 0, 1);
  const wholeOpacity = t < 4.6 ? 1 : 1 - clamp((t - 4.6) / 0.5, 0, 1);

  // Subtle camera push
  const camScale = 1 + 0.04 * Easing.easeOutCubic(clamp(t / 5, 0, 1));

  return (
    <Sprite start={0} end={5}>
      <div style={{
        position: 'absolute', inset: 0,
        background: '#000',
        opacity: wholeOpacity,
        transform: `scale(${camScale})`,
        transformOrigin: 'center',
      }}>
        {/* Faint grain */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(245,166,35,0.05) 0%, transparent 60%)',
        }}/>

        {/* Terminal block centered */}
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 1100,
          fontFamily: TD_FONTS.mono,
        }}>
          {/* Status pip + project name */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            color: TD_COLORS.inkSoft, fontSize: 16,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            marginBottom: 32,
            opacity: clamp(t / 0.4, 0, 1),
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TD_COLORS.accent }}/>
            tweak-design
          </div>

          {/* Prompt line */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 16,
            fontSize: 38, color: TD_COLORS.ink,
          }}>
            <span style={{ color: TD_COLORS.accent }}>$</span>
            <span>
              {visibleCmd}
              <span style={{
                display: 'inline-block',
                width: '0.6ch',
                marginLeft: 2,
                background: caretOn ? TD_COLORS.ink : 'transparent',
                color: 'transparent',
                height: '1.05em',
                verticalAlign: '-0.15em',
              }}>|</span>
            </span>
          </div>

          {/* Wordmark + tagline (replaces below cmd as scene resolves) */}
          <div style={{
            marginTop: 80,
            opacity: wordmarkOpacity,
            transform: `translateY(${(1 - wordmarkOpacity) * 12}px)`,
          }}>
            <div style={{
              fontFamily: TD_FONTS.serif,
              fontSize: 96,
              fontWeight: 400,
              color: TD_COLORS.ink,
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              tweak-<span style={{ fontStyle: 'italic', color: TD_COLORS.accent }}>design</span>
            </div>
            <div style={{
              marginTop: 18,
              fontFamily: TD_FONTS.mono,
              fontSize: 16,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: TD_COLORS.inkSoft,
              opacity: taglineOpacity,
            }}>
              the visual review step for vibe-coded layouts
            </div>
          </div>
        </div>
      </div>
    </Sprite>
  );
}

window.Scene1Open = Scene1Open;
