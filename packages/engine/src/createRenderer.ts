import { CpuRenderer } from './cpu/cpuRenderer';
import { GradeRenderer } from './gl/renderer';
import type { Renderer } from './types';

export interface RendererOptions {
  /** Skips WebGL2, as VITE_FORCE_CPU_ENGINE asks. */
  forceCpu?: boolean;
  /**
   * Called when the GPU context is lost. A canvas that held a WebGL context cannot be reused for
   * 2D, so the caller must make a new canvas and call createRenderer with forceCpu.
   */
  onContextLost?: () => void;
}

export function createRenderer(canvas: HTMLCanvasElement, options: RendererOptions = {}): Renderer {
  const useGpu = !options.forceCpu && GradeRenderer.usable();
  const gpu = useGpu ? GradeRenderer.create(canvas, options.onContextLost) : null;
  return gpu ?? new CpuRenderer(canvas);
}

export { CpuRenderer, GradeRenderer };
export { createExportGrader, GpuLostError, type ExportGrader } from './exportGrader';
export { cropTile, planStrips, planTiles, type Tile } from './tiles';
