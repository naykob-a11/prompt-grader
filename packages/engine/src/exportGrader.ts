import type { WorkerRequest, WorkerResponse } from './cpu/worker';
import { GradeRenderer } from './gl/renderer';
import type { Params } from './schema';
import { planStrips, planTiles, type Tile } from './tiles';
import type { GradeContext } from './types';

const CPU_STRIP_ROWS = 256;

/** Grades a full-size image piece by piece. */
export interface ExportGrader {
  readonly backend: 'webgl2' | 'cpu';
  plan(width: number, height: number): Tile[];
  /** Takes the padded region of a piece, and returns the pixels of the piece itself. */
  grade(
    region: Uint8ClampedArray,
    tile: Tile,
    params: Params,
    ctx: GradeContext,
  ): Promise<Uint8ClampedArray>;
  dispose(): void;
}

/** The GPU went away during an export, which can restart on the CPU. */
export class GpuLostError extends Error {}

function gpuGrader(tileSize: number): ExportGrader | null {
  const renderer = GradeRenderer.create(document.createElement('canvas'));
  if (!renderer) return null;
  renderer.releaseContext = true;
  return {
    backend: 'webgl2',
    plan: (width, height) => planTiles(width, height, Math.min(tileSize, renderer.maxTextureSize)),
    grade: (region, tile, params, ctx) => {
      const pixels = renderer.gradeTile(region, tile, params, ctx);
      if (renderer.contextLost) throw new GpuLostError();
      return Promise.resolve(pixels);
    },
    dispose: () => renderer.dispose(),
  };
}

function cpuGrader(): ExportGrader {
  const worker = new Worker(new URL('./cpu/worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, (data: Uint8ClampedArray) => void>();
  let nextId = 0;
  worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    pending.get(data.id)?.(data.data);
    pending.delete(data.id);
  };
  return {
    backend: 'cpu',
    plan: (width, height) => planStrips(width, height, CPU_STRIP_ROWS),
    grade: (region, strip, params, ctx) =>
      new Promise((resolve) => {
        const id = ++nextId;
        pending.set(id, resolve);
        const message: WorkerRequest = { type: 'strip', id, region, strip, params, ctx };
        worker.postMessage(message, [region.buffer]);
      }),
    dispose: () => worker.terminate(),
  };
}

export function createExportGrader(options: { forceCpu: boolean; tileSize: number }): ExportGrader {
  const gpu = options.forceCpu ? null : gpuGrader(options.tileSize);
  return gpu ?? cpuGrader();
}
