import type { Params } from './schema';

/** Per-image values, computed once and shared by every strip or tile. */
export interface GradeContext {
  wbGains: readonly [number, number, number];
  fullWidth: number;
  fullHeight: number;
}

/** RGBA pixels, top row first. */
export interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Draws the graded image to a canvas. Implemented by the WebGL2 and CPU backends. */
export interface Renderer {
  readonly backend: 'webgl2' | 'cpu';
  setImage(image: RawImage, ctx: GradeContext): void;
  /** Schedules a redraw; rapid calls collapse into one frame. */
  setParams(params: Params): void;
  /** Resolves once the current parameters are on the canvas. */
  render(): Promise<void>;
  dispose(): void;
}
