// Scene 3: Tweak panel zoom — camera zooms into the right rail, cursor
// moves to the Accent color, all 3 canvases tint as the value changes.
// Window: 13 → 22s

function Scene3Tweak() {
  const { time } = useTimeline();
  const t = time;
  const sceneStart = 13;
  const sceneEnd = 22;

  if (t < sceneStart - 0.3 || t > sceneEnd + 0.3) return null;

  const local = t - sceneStart;
  const dur = sceneEnd - sceneStart;

  // Cross-fade in 0 → 0.5, out (dur-0.5) → dur
  const opacity = local < 0.5
    ? Easing.easeOutCubic(clamp(local / 0.5, 0, 1))
    : local > dur - 0.5
      ? 1 - Easing.easeInCubic(clamp((local - (dur - 0.5)) / 0.5, 0, 1))
      : 1;

  // Camera: starts wide on hero, then zooms toward the right rail (tweak panel).
  // Hero shot is 1920x1080. Tweak panel sits roughly x=1500..1920, y=0..1080
  // when scaled to the frame. We'll push toward x=1700, scale=1.5.
  const camScale = ease(local, [
    {t: 0,   v: 1.0},
    {t: 1.6, v: 1.0},
    {t: 3.2, v: 1.55},
    {t: 7.5, v: 1.55},
    {t: dur, v: 1.5},
  ]);
  const camX = ease(local, [
    {t: 0,   v: 0.5},
    {t: 1.6, v: 0.5},
    {t: 3.2, v: 0.84},
    {t: 7.5, v: 0.84},
    {t: dur, v: 0.84},
  ]);
  const camY = ease(local, [
    {t: 0,   v: 0.5},
    {t: 1.6, v: 0.5},
    {t: 3.2, v: 0.45},
    {t: 7.5, v: 0.45},
    {t: dur, v: 0.45},
  ]);

  // Color tint that simulates the accent color changing.
  // Start with neutral (no tint), then around 4-6s flash an orange overlay
  // on each layout one by one.
  const tintPhase = clamp((local - 4.0) / 2.5, 0, 1);

  // Cursor path: start offscreen-right, glide to the accent swatch (~x=1700,y=240)
  // click at 4.0s, then drift to next swatch.
  const cx = ease(local, [
    {t: 0.0, v: 1900},
    {t: 1.8, v: 1750},
    {t: 3.6, v: 1700},
    {t: 4.0, v: 1675},
    {t: 5.0, v: 1675},
    {t: 6.5, v: 1700},
    {t: 8.5, v: 1740},
  ]);
  const cy = ease(local, [
    {t: 0.0, v: 200},
    {t: 1.8, v: 220},
    {t: 3.6, v: 230},
    {t: 4.0, v: 235},
    {t: 5.0, v: 235},
    {t: 6.5, v: 700},
    {t: 8.5, v: 870},
  ]);
  const clicking = local > 4.0 && local < 4.3;

  const SHOT_H = 1080 - 180;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, background: '#000' }}>
     <div style={{
       position: 'absolute', left: 0, top: 0, width: 1920, height: SHOT_H,
       overflow: 'hidden',
     }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 1920, height: 1080,
        transform: `scale(${camScale}) translate(${(0.5 - camX) * 1920 / camScale}px, ${(0.5 - camY) * 1080 / camScale}px)`,
        transformOrigin: '50% 50%',
      }}>
        <img src="shots/01-hero.webp" alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>

        {/* Color tint overlays — positioned over each of the 3 canvas frames in shot 01
            Approx canvas regions in 1920x1080:
            A: x=63 .. 367,  y=42 .. 1010
            B: x=393 .. 696, y=42 .. 1010
            C: x=722 .. 1024, y=42 .. 1010
            Right rail starts ~x=1500
            (these are approximate based on the 1000x707 ratio of the screenshot)
        */}
        {[
          { left: 70, top: 50, width: 295, height: 940 },
          { left: 405, top: 50, width: 290, height: 940 },
          { left: 720, top: 50, width: 305, height: 940 },
        ].map((r, i) => {
          // Each tint flashes in sequence: 4.0, 4.25, 4.5
          const fStart = 4.0 + i * 0.18;
          const fEnd = fStart + 1.6;
          const flash = clamp((local - fStart) / 0.25, 0, 1) * (1 - clamp((local - fEnd) / 0.4, 0, 1));
          return (
            <div key={i} style={{
              position: 'absolute',
              left: r.left, top: r.top,
              width: r.width, height: r.height,
              background: 'rgba(245, 166, 35, 0.18)',
              mixBlendMode: 'screen',
              opacity: flash,
              pointerEvents: 'none',
              borderRadius: 6,
            }}/>
          );
        })}

        {/* Highlight ring on the accent swatch when cursor clicks */}
        <div style={{
          position: 'absolute',
          left: 1632, top: 198,
          width: 110, height: 56,
          border: `2px solid ${TD_COLORS.accent}`,
          borderRadius: 8,
          opacity: clamp((local - 3.8) / 0.3, 0, 1) * (1 - clamp((local - 6.8) / 0.4, 0, 1)),
          boxShadow: `0 0 24px rgba(245,166,35,0.4)`,
        }}/>

        <Cursor x={cx} y={cy} clicking={clicking} opacity={1}/>
      </div>
     </div>

      <Sprite start={sceneStart + 1.0} end={sceneStart + 8.0}>
        <CaptionBar
          text={"Tweak tokens. All layouts react in real time."}
          sub="02 / Tokens"
          height={180}
        />
      </Sprite>
    </div>
  );
}

window.Scene3Tweak = Scene3Tweak;
