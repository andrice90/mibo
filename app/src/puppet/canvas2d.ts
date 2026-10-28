/**
 * Just enough of CanvasRenderingContext2D, Path2D and OffscreenCanvas, drawn
 * with React Native Skia, for prototypes/mibo-puppet/mibo-puppet.js to run
 * unchanged. The lab in the browser and the app then draw the same Mibo from
 * the same file, so tuning done in the lab carries over.
 *
 * Only what the puppet uses is here: paths, fills, strokes, clips, linear and
 * radial gradients, repeat patterns, alpha, the multiply blend, and the
 * ImageData calls that build its paper and pencil textures.
 */
import {
  AlphaType,
  BlendMode,
  ClipOp,
  ColorType,
  FillType,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkPath,
  type SkPathBuilder,
  type SkShader,
  type SkSurface,
} from '@shopify/react-native-skia';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ Path2D

export class Path2D {
  private b: SkPathBuilder = Skia.PathBuilder.Make();
  private open = false;
  private cache: { nonzero?: SkPath; evenodd?: SkPath } = {};

  private touch() { this.cache = {}; }
  moveTo(x: number, y: number) { this.b.moveTo(x, y); this.open = true; this.touch(); }
  lineTo(x: number, y: number) {
    if (this.open) this.b.lineTo(x, y); else this.b.moveTo(x, y);
    this.open = true; this.touch();
  }
  closePath() { this.b.close(); this.touch(); }
  rect(x: number, y: number, w: number, h: number) {
    this.b.addRect(Skia.XYWHRect(x, y, w, h)); this.b.moveTo(x, y); this.open = true; this.touch();
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false) {
    let sweep = a1 - a0;
    if (ccw) sweep = sweep > 0 ? sweep - TAU : sweep;
    if (Math.abs(sweep) > TAU) sweep = Math.sign(sweep) * TAU;
    const n = Math.max(8, Math.ceil(Math.abs(sweep) / TAU * 64));
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const t = a0 + sweep * i / n, ex = Math.cos(t) * rx, ey = Math.sin(t) * ry;
      this.lineTo(cx + ex * c - ey * s, cy + ex * s + ey * c);
    }
  }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) { this.ellipse(cx, cy, r, r, 0, a0, a1, ccw); }
  addPath(p: Path2D) { this.b.addPath(p.sk('nonzero')); this.open = false; this.touch(); }

  sk(rule: 'nonzero' | 'evenodd' = 'nonzero'): SkPath {
    let p = this.cache[rule];
    if (!p) {
      const b = Skia.PathBuilder.MakeFromPath(this.b.build());
      b.setFillType(rule === 'evenodd' ? FillType.EvenOdd : FillType.Winding);
      p = this.cache[rule] = b.build();
    }
    return p;
  }
}

// ------------------------------------------------------------------ styles

type Stop = [number, string];

class Gradient {
  stops: Stop[] = [];
  constructor(private make: (colors: Float32Array[], pos: number[]) => SkShader) {}
  addColorStop(at: number, color: string) { this.stops.push([at, color]); }
  shader() {
    const s = [...this.stops].sort((a, b) => a[0] - b[0]);
    return this.make(s.map(x => Skia.Color(x[1])), s.map(x => x[0]));
  }
}

class Pattern {
  constructor(private image: SkImage) {}
  setTransform() {}  // the puppet only nudges pencil grain per boil frame; not needed
  shader() { return this.image.makeShaderOptions(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, MipmapMode.None); }
}

type Style = string | Gradient | Pattern;

type ImageDataLike = { width: number; height: number; data: Uint8ClampedArray };

interface State {
  fillStyle: Style; strokeStyle: Style; lineWidth: number; lineJoin: string; lineCap: string;
  globalAlpha: number; globalCompositeOperation: string;
}

const JOIN: Record<string, StrokeJoin> = { round: StrokeJoin.Round, bevel: StrokeJoin.Bevel, miter: StrokeJoin.Miter };
const CAP: Record<string, StrokeCap> = { round: StrokeCap.Round, square: StrokeCap.Square, butt: StrokeCap.Butt };

// ------------------------------------------------------------------ context

export class Canvas2D implements State {
  canvas!: SkCanvas;
  fillStyle: Style = '#000';
  strokeStyle: Style = '#000';
  lineWidth = 1;
  lineJoin = 'miter';
  lineCap = 'butt';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  private stack: State[] = [];
  private current = new Path2D();
  private shaders = new WeakMap<object, SkShader>();

  constructor(canvas?: SkCanvas) { if (canvas) this.canvas = canvas; }

  /** Point at a new Skia canvas (one per recorded frame); textures stay cached on this object. */
  begin(canvas: SkCanvas) {
    this.canvas = canvas;
    this.stack = [];
    Object.assign(this, { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineJoin: 'miter', lineCap: 'butt',
      globalAlpha: 1, globalCompositeOperation: 'source-over' });
  }

  save() {
    const { fillStyle, strokeStyle, lineWidth, lineJoin, lineCap, globalAlpha, globalCompositeOperation } = this;
    this.stack.push({ fillStyle, strokeStyle, lineWidth, lineJoin, lineCap, globalAlpha, globalCompositeOperation });
    this.canvas.save();
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    Object.assign(this, s);
    this.canvas.restore();
  }
  translate(x: number, y: number) { this.canvas.translate(x, y); }
  rotate(a: number) { this.canvas.rotate(a * 180 / Math.PI, 0, 0); }
  scale(x: number, y: number) { this.canvas.scale(x, y); }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new Gradient((c, p) => Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, c, p, TileMode.Clamp));
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new Gradient((c, p) => Skia.Shader.MakeTwoPointConicalGradient({ x: x0, y: y0 }, r0, { x: x1, y: y1 }, r1, c, p, TileMode.Clamp));
  }
  createPattern(src: OffscreenCanvas | HTMLCanvasElement) {
    // the puppet asks for the paper pattern every frame; its pixels never change
    let p = this.patterns.get(src);
    if (!p) { p = new Pattern(src instanceof OffscreenCanvas ? src.image() : domImage(src)); this.patterns.set(src, p); }
    return p;
  }
  private patterns = new WeakMap<object, Pattern>();

  private paint(style: Style, stroke: boolean) {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    if (typeof style === 'string') {
      const c = Skia.Color(style);
      c[3] *= this.globalAlpha;
      p.setColor(c);
    } else {
      let sh = this.shaders.get(style);
      if (!sh) { sh = style.shader(); if (style instanceof Pattern) this.shaders.set(style, sh); }
      p.setShader(sh);
      p.setAlphaf(this.globalAlpha);
    }
    if (this.globalCompositeOperation === 'multiply') p.setBlendMode(BlendMode.Multiply);
    if (stroke) {
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(this.lineWidth);
      p.setStrokeJoin(JOIN[this.lineJoin] ?? StrokeJoin.Miter);
      p.setStrokeCap(CAP[this.lineCap] ?? StrokeCap.Butt);
    }
    return p;
  }

  beginPath() { this.current = new Path2D(); }
  moveTo(x: number, y: number) { this.current.moveTo(x, y); }
  lineTo(x: number, y: number) { this.current.lineTo(x, y); }
  closePath() { this.current.closePath(); }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw?: boolean) { this.current.arc(cx, cy, r, a0, a1, ccw); }
  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean) {
    this.current.ellipse(cx, cy, rx, ry, rot, a0, a1, ccw);
  }
  rect(x: number, y: number, w: number, h: number) { this.current.rect(x, y, w, h); }

  fill(a?: Path2D | 'nonzero' | 'evenodd', b?: 'nonzero' | 'evenodd') {
    const path = a instanceof Path2D ? a : this.current;
    const rule = (a instanceof Path2D ? b : a) || 'nonzero';
    this.canvas.drawPath(path.sk(rule), this.paint(this.fillStyle, false));
  }
  stroke(path?: Path2D) {
    this.canvas.drawPath((path || this.current).sk(), this.paint(this.strokeStyle, true));
  }
  clip(a?: Path2D | 'nonzero' | 'evenodd', b?: 'nonzero' | 'evenodd') {
    const path = a instanceof Path2D ? a : this.current;
    const rule = (a instanceof Path2D ? b : a) || 'nonzero';
    this.canvas.clipPath(path.sk(rule), ClipOp.Intersect, true);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.canvas.drawRect(Skia.XYWHRect(x, y, w, h), this.paint(this.fillStyle, false));
  }
  clearRect(x: number, y: number, w: number, h: number) {
    const p = Skia.Paint(); p.setBlendMode(BlendMode.Clear);
    this.canvas.drawRect(Skia.XYWHRect(x, y, w, h), p);
  }

  // ImageData, only for the offscreen texture canvases
  owner?: OffscreenCanvas;
  createImageData(w: number, h: number): ImageDataLike { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  putImageData(im: ImageDataLike, x: number, y: number) {
    const img = Skia.Image.MakeImage(
      { width: im.width, height: im.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      Skia.Data.fromBytes(new Uint8Array(im.data.buffer)), im.width * 4);
    if (!img) return;
    const p = Skia.Paint(); p.setBlendMode(BlendMode.Src);
    this.canvas.drawImage(img, x, y, p);
  }
  getImageData(x: number, y: number, w: number, h: number): ImageDataLike {
    const px = this.owner!.image().readPixels(x, y, {
      width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul,
    });
    return { width: w, height: h, data: new Uint8ClampedArray(px ? (px as Uint8Array) : new Uint8Array(w * h * 4)) };
  }
}

/** In the web build the puppet paints its textures on real DOM canvases; copy their pixels into Skia. */
function domImage(c: HTMLCanvasElement): SkImage {
  const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  return Skia.Image.MakeImage(
    { width: c.width, height: c.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    Skia.Data.fromBytes(new Uint8Array(px.buffer)), c.width * 4)!;
}

// ------------------------------------------------------------------ OffscreenCanvas

export class OffscreenCanvas {
  private surface: SkSurface;
  private ctx: Canvas2D;
  constructor(public width: number, public height: number) {
    const s = Skia.Surface.Make(width, height);
    if (!s) throw new Error('Skia could not make an offscreen surface');
    this.surface = s;
    this.ctx = new Canvas2D(s.getCanvas());
    this.ctx.owner = this;
  }
  getContext() { return this.ctx; }
  image() { this.surface.flush(); return this.surface.makeImageSnapshot(); }
}

/** The puppet looks these up as globals, the way it finds them in a browser. */
export function installCanvasGlobals() {
  const g = globalThis as Record<string, unknown>;
  g.Path2D = Path2D;
  g.OffscreenCanvas = OffscreenCanvas;
}
