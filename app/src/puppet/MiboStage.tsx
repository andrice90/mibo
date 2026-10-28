import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { Canvas2D } from './canvas2d';
import { getMibo, type Puppet } from './mibo';

const LOOK = { style: 'sketch', outline: 13, brows: true, mouthScale: 1.15 };
const ACCENT = '#2c7a5c';

const blank = () => {
  const r = Skia.PictureRecorder();
  r.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return r.finishRecordingAsPicture();
};

type Snap ={ P: Record<string, number>; parts: Puppet['particles']; t: number; watch: number };

/**
 * Draws a Puppet the way the lab's hand-drawn stage does: the body is held at
 * STYLE.motionFps, the mouth swaps shapes at STYLE.mouthFps (each drawing is
 * the shape targeted longest in its window), and lines boil at STYLE.boilFps.
 */
export function MiboStage({ puppet }: { puppet: Puppet }) {
  const picture = useSharedValue<SkPicture>(blank());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const cam = useRef({ s: 1, ox: 0, oy: 0 });

  useEffect(() => {
    const { w: W, h: H } = size;
    if (!W || !H) return;
    const Mibo = getMibo(), S = Mibo.STYLE;
    const ctx = new Canvas2D();
    let raf = 0, last = performance.now();
    let acc = 1, mouthAcc = 1, boilAcc = 0, boilFrame = 0, dirty = true;
    let mouthTime: Record<string, number> = {};
    let pose: Snap | null = null, mouth: Record<string, number> | null = null;

    const holdMouth = () => {
      let top: string | null = null;
      for (const k in mouthTime) if (!top || mouthTime[k] > mouthTime[top]) top = k;
      mouthTime = {};
      const src = top ? Mibo.mouthOf(top) : puppet.P, m: Record<string, number> = {};
      for (const k of Mibo.MOUTH_KEYS) m[k] = src[k];
      return m;
    };
    const holdPose = (): Snap => ({
      P: { ...puppet.P }, parts: puppet.particles.map(p => ({ ...p })), t: puppet.t, watch: puppet.watch,
    });

    const render = (snap: Snap, seed: number) => {
      const P = snap.P;
      const sc = Math.min(W / S.frame, H / (S.frame - 50)) * P.camZoom;
      cam.current = { s: sc, ox: W / 2 - P.camX * sc, oy: H / 2 - P.camY * sc };
      const rec = Skia.PictureRecorder();
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
      ctx.begin(canvas);
      Mibo.drawPaper(ctx, W, H, S.paper);
      canvas.save();
      canvas.translate(cam.current.ox, cam.current.oy);
      canvas.scale(sc, sc);
      const o = { ...LOOK, seed, boil: S.boil, bleed: S.bleed };
      Mibo.drawMibo(ctx, P, o);
      Mibo.drawFx(ctx, P, snap.t, ACCENT, o);
      Mibo.drawParticles(ctx, snap.parts, o);
      canvas.restore();
      if (snap.watch > 0.02) {
        // soft spotlight on the mouth during "watch me"
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.16 * snap.watch})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      picture.value = rec.finishRecordingAsPicture();
    };

    const frame = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      puppet.update(dt);
      const k = puppet.mouthKey;
      if (k) mouthTime[k] = (mouthTime[k] || 0) + dt * (k === 'gap' ? 0.4 : 1);
      acc += dt; mouthAcc += dt; boilAcc += dt;
      if (boilAcc >= 1 / S.boilFps) { boilAcc %= 1 / S.boilFps; boilFrame = (boilFrame + 1) % 3; dirty = true; }
      if (acc >= 1 / S.motionFps || !pose) { acc %= 1 / S.motionFps; pose = holdPose(); dirty = true; }
      if (mouthAcc >= 1 / S.mouthFps || !mouth) { mouthAcc %= 1 / S.mouthFps; mouth = holdMouth(); dirty = true; }
      if (dirty) {
        render({ ...pose, P: { ...pose.P, ...mouth } }, boilFrame);
        dirty = false;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, puppet, picture]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: Math.round(width), h: Math.round(height) });
  };
  const toWorld = (e: GestureResponderEvent): [number, number] => {
    const { s, ox, oy } = cam.current;
    return [(e.nativeEvent.locationX - ox) / s, (e.nativeEvent.locationY - oy) / s];
  };

  return (
    <Pressable style={styles.frame} onLayout={onLayout} onPressIn={e => puppet.poke(...toWorld(e))}>
      <Canvas style={styles.fill}>
        <Picture picture={picture} />
      </Canvas>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Mibo's paper stage as a rounded picture-book page
  frame: {
    flex: 1, borderRadius: 32, overflow: 'hidden', borderWidth: 3, borderColor: '#ffffff',
    shadowColor: '#6b5a8e', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
});
