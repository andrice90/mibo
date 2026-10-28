/**
 * The shared puppet module, loaded into the app. The source of truth is
 * prototypes/mibo-puppet/mibo-puppet.js (the browser lab uses the same file);
 * it draws through the Canvas2D shim in ./canvas2d.
 */
import { installCanvasGlobals } from './canvas2d';

export type Viseme = { v: string; d: number; i?: number; hold?: boolean };

/** One step of a puppet script. `visemes` + `clock` let real audio drive the mouth. */
export type Segment = {
  say?: string; visemes?: Viseme[]; clock?: () => number;
  model?: string; hold?: number; watch?: boolean; watchAll?: boolean; watchHolds?: boolean;
  mood?: string; act?: string; wait?: number; caption?: string; call?: () => void;
};

export type Particle = { kind: string; x: number; y: number; ttl: number; max: number; rot: number; color: string };

export interface Puppet {
  P: Record<string, number>;
  mood: string;
  mouthKey: string | null;
  particles: Particle[];
  t: number;
  watch: number;
  energy: number;
  busy: boolean;
  onCaption: ((text: string, i: number) => void) | null;
  setMood(m: string): void;
  hold(v: string | null, watch?: boolean): void;
  act(name: string): void;
  play(script: Segment[], onDone?: () => void): void;
  stop(): void;
  poke(x: number, y: number): boolean;
  point(x: number, y: number): void;
  update(dt: number): void;
}

type DrawOpts = { style?: string; outline?: number; brows?: boolean; mouthScale?: number; seed?: number; boil?: number; bleed?: number };

interface MiboModule {
  STYLE: { style: string; motionFps: number; mouthFps: number; boilFps: number; boil: number; bleed: number; paper: number; frame: number };
  MOUTH_KEYS: string[];
  VISEMES: Record<string, Record<string, number>>;
  mouthOf(v: string): Record<string, number>;
  drawMibo(ctx: unknown, P: Record<string, number>, opts: DrawOpts): void;
  drawFx(ctx: unknown, P: Record<string, number>, t: number, accent: string, opts: DrawOpts): void;
  drawParticles(ctx: unknown, parts: Particle[], opts: DrawOpts): void;
  drawPaper(ctx: unknown, w: number, h: number, grain: number): void;
  Puppet: new () => Puppet;
}

let loaded: MiboModule | null = null;

/**
 * The puppet module, loaded on first use rather than at import, so the web
 * build's server-side render never evaluates it (Metro's server bundle loses
 * track of it when the prototype file changes during development).
 */
export function getMibo(): MiboModule {
  if (!loaded) {
    installCanvasGlobals();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../../prototypes/mibo-puppet/mibo-puppet.js');
    loaded = (globalThis as unknown as { Mibo: MiboModule }).Mibo;
  }
  return loaded;
}

/** Captions: the puppet reports the line it is saying and the character it has reached. */
export function listenCaptions(p: Puppet, f: ((text: string, i: number) => void) | null) {
  p.onCaption = f;
}
