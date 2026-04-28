// Scene 4: Focus mode — tab "C Keynote" gets clicked, transitions from
// 2-pane to focus view (shot 03-focus.png).
// Window: 22 → 30s

function Scene4Focus() {
  const { time } = useTimeline();
  const t = time;
  const sceneStart = 22;
  const sceneEnd = 30;

  if (t < sceneStart - 0.3 || t > sceneEnd + 0.3) return null;

  const local = t - sceneStart;
  const dur = sceneEnd - sceneStart;

  const opacity = local < 0.5
    ? Easing.easeOutCubic(clamp(local / 0.5, 0, 1))
    : local > dur - 0.5
      ? 1 - Easing.easeInCubic(clamp((local - (dur - 0.5)) / 0.5, 0, 1))
      : 1;

  const switchAt = 2.4;

  const cx1 = ease(local, [
    {t: 0.0, v: 800},
    {t: 1.6, v: 660},
    {t: 2.4, v: 614},
  ]);
  const cy1 = ease(local, [
    {t: 0.0, v: 600},
    {t: 1.6, v: 100},
    {t: 2.4, v: 24},
  ]);

  const cx2 = ease(local, [
    {t: switchAt, v: 614},
    {t: 4.5, v: 700},
    {t: 7.0, v: 1100},
  ]);
  const cy2 = ease(local, [
    {t: switchAt, v: 24},
    {t: 4.5, v: 380},
    {t: 7.0, v: 600},
  ]);

  const firstOpacity = local < switchAt
    ? 1
    : 1 - clamp((local - switchAt) / 0.3, 0, 1);
  const secondOpacity = clamp((local - switchAt) / 0.3, 0, 1);

  const k = clamp((local - switchAt) / (dur - switchAt), 0, 1);
  const focusScale = 1 + 0.05 * Easing.easeInOutSine(k);
  const focusTx = -8 * k;

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
          {/* Stage 1: 2-pane */}
          <div style={{ position: 'absolute', inset: 0, opacity: firstOpacity }}>
            <img src="shots/02-two-pane.webp" alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            <div style={{
              position: 'absolute',
              left: 595, top: 12,
              width: 110, height: 30,
              border: `2px solid ${TD_COLORS.accent}`,
              borderRadius: 16,
              opacity: clamp((local - 1.8) / 0.4, 0, 1),
            }}/>
            <Cursor x={cx1} y={cy1} clicking={local > 2.3 && local < 2.55}/>
          </div>

          {/* Stage 2: focus */}
          <div style={{ position: 'absolute', inset: 0, opacity: secondOpacity }}>
            <div style={{
              position: 'absolute', inset: 0,
              transform: `scale(${focusScale}) translateX(${focusTx}px)`,
              transformOrigin: 'center',
            }}>
              <img src="shots/03-focus.webp" alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            </div>
            {local >= switchAt + 0.3 && (
              <Cursor x={cx2} y={cy2}/>
            )}
          </div>
        </div>
      </div>

      <Sprite start={sceneStart + 0.4} end={sceneStart + 7.6}>
        <CaptionBar
          text={"Click any tab to focus. Inspect the details."}
          sub="03 / Focus mode"
          height={180}
        />
      </Sprite>
    </div>
  );
}

window.Scene4Focus = Scene4Focus;
