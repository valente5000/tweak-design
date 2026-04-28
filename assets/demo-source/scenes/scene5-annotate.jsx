// Scene 5: Annotations — pins drop, quadrants drag in, sidebar fills with notes.
// Window: 30 → 40s
// Built on top of shots/04-annotations.webp (which already shows pins + quadrants)

function Scene5Annotate() {
  const { time } = useTimeline();
  const t = time;
  const sceneStart = 30;
  const sceneEnd = 40;

  if (t < sceneStart - 0.3 || t > sceneEnd + 0.3) return null;
  const local = t - sceneStart;
  const dur = sceneEnd - sceneStart;

  const opacity = local < 0.5
    ? Easing.easeOutCubic(clamp(local / 0.5, 0, 1))
    : local > dur - 0.5
      ? 1 - Easing.easeInCubic(clamp((local - (dur - 0.5)) / 0.5, 0, 1))
      : 1;

  // Strategy: use shot 03 (focus, no annotations) as base, then animate
  // pins/quadrants in over time, drawing them ourselves so they appear
  // sequentially. After they're all in, crossfade to shot 04 for fidelity.
  // Simpler: show shot 04 immediately but mask annotations with rectangles
  // that wipe away in sequence. For now, animate pins as overlays on shot 03.

  // Pin coords (in 1920x1080) — derived from shot 04, which is 1920x1080-ish
  // The screenshot is 3674x2576 source; ratios roughly:
  // Pin #1 at (760,115) screenshot coord → ratio (~0.21, ~0.045) of 3674x2576
  // We'll just place pins by approximate visual matching to shot 03 layout.

  const pins = [
    { id: 1, type: 'pin',  x: 760, y: 200, label: 'Mudar a foto do Hero',     dropAt: 1.0 },
    { id: 2, type: 'rect', x: 84,  y: 700, w: 295, h: 80, label: 'Tirar o by',           dropAt: 2.6 },
    { id: 3, type: 'rect', x: 80,  y: 800, w: 1380, h: 110, label: 'Diminuir o espaço entre blocos', dropAt: 4.2 },
    { id: 4, type: 'rect', x: 84,  y: 940, w: 1380, h: 200, label: 'Utilizar fotos 4:3 e tentar limitar a mesma altura da chamada', dropAt: 5.8 },
  ];

  // Cursor moves between pin drop sites
  const cursorPath = [
    {t: 0.5, x: 1500, y: 600},
    {t: 1.0, x: 760,  y: 200},
    {t: 2.0, x: 760,  y: 200},
    {t: 2.6, x: 230,  y: 740},
    {t: 3.6, x: 230,  y: 740},
    {t: 4.2, x: 770,  y: 855},
    {t: 5.2, x: 770,  y: 855},
    {t: 5.8, x: 770,  y: 1040},
    {t: 7.0, x: 770,  y: 1040},
    {t: 8.5, x: 1700, y: 600},
  ];
  const cx = ease(local, cursorPath.map(p => ({t: p.t, v: p.x})));
  const cy = ease(local, cursorPath.map(p => ({t: p.t, v: p.y})));

  // Camera: slight zoom out at end to show sidebar filling
  const camScale = ease(local, [
    {t: 0,   v: 1.05},
    {t: 7.0, v: 1.05},
    {t: 9.0, v: 1.0},
  ]);
  const camX = ease(local, [
    {t: 0,   v: -50},
    {t: 7.0, v: -50},
    {t: 9.0, v: 0},
  ]);

  const SHOT_H = 1080 - 180;
  const shotScale = SHOT_H / 1080;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, background: '#000' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 1920, height: SHOT_H,
        overflow: 'hidden',
      }}>
       <div style={{
         position: 'absolute', left: 0, top: 0, width: 1920, height: 1080,
         transform: `scale(${shotScale})`,
         transformOrigin: '0 0',
       }}>
        <div style={{
          position: 'absolute', inset: 0,
          transform: `scale(${camScale}) translateX(${camX}px)`,
          transformOrigin: 'center',
        }}>
        <img src="shots/03-focus.webp" alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>

        {/* Animate annotations as overlays */}
        {pins.map(p => {
          if (local < p.dropAt) return null;
          const age = local - p.dropAt;
          const dropProg = Easing.easeOutBack(clamp(age / 0.35, 0, 1));
          const opa = clamp(age / 0.2, 0, 1);

          if (p.type === 'pin') {
            return (
              <div key={p.id} style={{
                position: 'absolute',
                left: p.x - 14, top: p.y - 28,
                opacity: opa,
                transform: `scale(${dropProg}) translateY(${(1 - dropProg) * -20}px)`,
                transformOrigin: 'bottom center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: TD_COLORS.red,
                  border: '2px solid #fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                  fontFamily: TD_FONTS.mono,
                  fontSize: 13, fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}>{p.id}</div>
                {/* Pulse ring */}
                {age < 0.6 && (
                  <div style={{
                    position: 'absolute', left: -8, top: -8,
                    width: 44, height: 44, borderRadius: 22,
                    border: `2px solid ${TD_COLORS.red}`,
                    opacity: 1 - age / 0.6,
                    transform: `scale(${1 + age * 1.2})`,
                  }}/>
                )}
              </div>
            );
          }

          // Rect quadrant
          const rectScale = clamp(age / 0.4, 0, 1);
          return (
            <div key={p.id} style={{
              position: 'absolute',
              left: p.x, top: p.y,
              width: p.w * rectScale, height: p.h,
              border: `2px dashed ${TD_COLORS.accent}`,
              borderRadius: 4,
              opacity: opa,
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}>
              <div style={{
                position: 'absolute',
                left: -2, top: -22,
                width: 22, height: 22,
                background: TD_COLORS.accent,
                color: TD_COLORS.accentInk,
                fontFamily: TD_FONTS.mono, fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 3,
              }}>{p.id}</div>
            </div>
          );
        })}

        {/* Sidebar annotations card list */}
        <div style={{
          position: 'absolute',
          right: 24, top: 480,
          width: 360,
          fontFamily: TD_FONTS.sans,
        }}>
          <div style={{
            fontFamily: TD_FONTS.mono,
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: TD_COLORS.inkDim,
            marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ANNOTATIONS
            <span style={{
              background: TD_COLORS.accent, color: TD_COLORS.accentInk,
              padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 700,
              opacity: clamp((local - 0.9) / 0.3, 0, 1),
            }}>{Math.min(4, Math.max(0, [1.0, 2.6, 4.2, 5.8].filter(x => local >= x).length))}</span>
          </div>
          {pins.map((p, i) => {
            if (local < p.dropAt + 0.3) return null;
            const age = local - p.dropAt - 0.3;
            const slideIn = Easing.easeOutCubic(clamp(age / 0.4, 0, 1));
            return (
              <div key={p.id} style={{
                background: TD_COLORS.panel,
                border: `1px solid ${TD_COLORS.border}`,
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: 8,
                display: 'flex', alignItems: 'flex-start', gap: 10,
                opacity: slideIn,
                transform: `translateX(${(1 - slideIn) * 24}px)`,
              }}>
                <div style={{
                  flexShrink: 0,
                  width: 18, height: 18, borderRadius: 9,
                  background: p.type === 'pin' ? TD_COLORS.red : TD_COLORS.accent,
                  color: p.type === 'pin' ? '#fff' : TD_COLORS.accentInk,
                  fontFamily: TD_FONTS.mono, fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>{p.id}</div>
                <div style={{
                  fontSize: 13,
                  color: TD_COLORS.ink,
                  lineHeight: 1.35,
                }}>{p.label}</div>
              </div>
            );
          })}
        </div>

        <Cursor x={cx} y={cy} clicking={[1.0, 2.6, 4.2, 5.8].some(d => local >= d && local < d + 0.2)}/>
      </div>
       </div>
      </div>

      <Sprite start={sceneStart + 0.4} end={sceneStart + 9.4}>
        <CaptionBar
          text={"Pin what's wrong. Box what to fix."}
          sub="04 / Annotate"
          height={180}
        />
      </Sprite>
    </div>
  );
}

window.Scene5Annotate = Scene5Annotate;
