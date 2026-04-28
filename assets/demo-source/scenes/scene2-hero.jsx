// Scene 2: Hero shot — pull back to reveal the playground with 3 layouts.
// Window: 5 → 13s
//
// Strategy: show the real screenshot (shots/01-hero.webp) full-bleed at the
// 1920x1080 frame, then ken-burns push-in toward the canvas region.

function Scene2Hero() {
  const { time } = useTimeline();
  const t = time;
  const sceneStart = 5;
  const sceneEnd = 13;

  if (t < sceneStart - 0.3 || t > sceneEnd + 0.3) return null;

  const local = t - sceneStart;
  const dur = sceneEnd - sceneStart;

  // Cross-fade in 0 → 0.6, fade out 7.5 → 8
  const opacity = local < 0.6
    ? Easing.easeOutCubic(clamp(local / 0.6, 0, 1))
    : local > dur - 0.5
      ? 1 - Easing.easeInCubic(clamp((local - (dur - 0.5)) / 0.5, 0, 1))
      : 1;

  // Ken burns: scale 1 -> 1.06, slow drift left
  const k = clamp(local / dur, 0, 1);
  const kEased = Easing.easeInOutSine(k);
  const scale = 1 + 0.06 * kEased;
  const tx = -28 * kEased;
  const ty = -10 * kEased;

  // Cursor sweeps in around 1.5s, hovers over canvas around 3-5s
  const cursorOpacity = clamp((local - 1.5) / 0.5, 0, 1) * (1 - clamp((local - 6.5) / 0.5, 0, 1));
  const cx = ease(local, [
    {t: 1.5, v: 200},
    {t: 3.0, v: 740},
    {t: 5.5, v: 1100},
    {t: 7.5, v: 1400},
  ]);
  const cy = ease(local, [
    {t: 1.5, v: 900},
    {t: 3.0, v: 540},
    {t: 5.5, v: 580},
    {t: 7.5, v: 480},
  ]);

  // Screenshot occupies frame minus 180px caption bar
  const SHOT_H = 1080 - 180;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, background: '#000' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 1920, height: SHOT_H,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
          transformOrigin: 'center',
        }}>
          <img src="shots/01-hero.webp" alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
        </div>
        <Cursor x={cx} y={cy * (SHOT_H/1080)} opacity={cursorOpacity}/>
      </div>

      <Sprite start={sceneStart + 0.4} end={sceneStart + 7.6}>
        <CaptionBar
          text={"Three directions. One playground."}
          sub="01 / Compare"
          height={180}
        />
      </Sprite>
    </div>
  );
}

window.Scene2Hero = Scene2Hero;
