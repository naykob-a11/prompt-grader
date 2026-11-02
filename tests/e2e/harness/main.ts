// Runs in the browser. Each function returns plain data for the Playwright specs to assert on.
import {
  BUILTIN_PRESETS,
  DEFAULT_PARAMS,
  gradeImage,
  grayWorld,
  PARAMS,
  type GradeContext,
  type Params,
  type RawImage,
} from '../../../packages/engine/src';
import { createRenderer, GradeRenderer } from '../../../packages/engine/src/createRenderer';
import { syntheticRamps } from '../../../packages/engine/test/support/synthetic';

export interface Comparison {
  label: string;
  maxDiff: number;
  /** Where the largest difference is, for debugging a failure. */
  at: { x: number; y: number; channel: number; cpu: number; gpu: number };
}

const image = syntheticRamps();
const contextFor = (img: RawImage): GradeContext => ({
  wbGains: grayWorld(img.data),
  fullWidth: img.width,
  fullHeight: img.height,
});
const ctx = contextFor(image);

const glCanvas = document.getElementById('gl') as HTMLCanvasElement;
const gpu = GradeRenderer.create(glCanvas);

function requireGpu(): GradeRenderer {
  if (!gpu) throw new Error('WebGL2 is not available in this browser');
  return gpu;
}

function compare(label: string, cpu: Uint8ClampedArray, other: Uint8ClampedArray): Comparison {
  let maxDiff = 0;
  let worst = 0;
  for (let i = 0; i < cpu.length; i++) {
    const d = Math.abs(cpu[i]! - other[i]!);
    if (d > maxDiff) {
      maxDiff = d;
      worst = i;
    }
  }
  const pixel = Math.floor(worst / 4);
  return {
    label,
    maxDiff,
    at: {
      x: pixel % image.width,
      y: Math.floor(pixel / image.width),
      channel: worst % 4,
      cpu: cpu[worst]!,
      gpu: other[worst]!,
    },
  };
}

function randomParams(count: number): Params[] {
  let seed = 7;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  return Array.from({ length: count }, () => {
    const p = { ...DEFAULT_PARAMS };
    for (const d of PARAMS) {
      if (rnd() < 0.4) p[d.key] = Math.round(d.min + rnd() * (d.max - d.min));
    }
    return p;
  });
}

function parityCases(): [string, Params][] {
  const extremes = PARAMS.flatMap((p): [string, Params][] => [
    [`${p.key} min`, { ...DEFAULT_PARAMS, [p.key]: p.min }],
    [`${p.key} max`, { ...DEFAULT_PARAMS, [p.key]: p.max }],
  ]);
  return [
    ...BUILTIN_PRESETS.map((p): [string, Params] => [`${p.id} grain 0`, { ...p.params, grain: 0 }]),
    ...BUILTIN_PRESETS.map((p): [string, Params] => [p.id, p.params]),
    ...extremes,
    ...randomParams(30).map((p, i): [string, Params] => [`random ${i}`, p]),
  ];
}

function gpuPixels(params: Params): Uint8ClampedArray {
  const renderer = requireGpu();
  renderer.setImage(image, ctx);
  renderer.setParams(params);
  return renderer.readPixels();
}

const harness = {
  glInfo() {
    const gl = requireGpu() && glCanvas.getContext('webgl2')!;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unknown',
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    };
  },

  parity(): Comparison[] {
    return parityCases().map(([label, params]) => {
      const cpu = gradeImage(image.data, image.width, image.height, params, ctx);
      return compare(label, cpu, gpuPixels(params));
    });
  },

  /** Debug aid: the difference left after resetting each active parameter of one parity case. */
  explain(label: string) {
    const params = parityCases().find(([name]) => name === label)![1];
    const diffWith = (p: Params) =>
      compare(label, gradeImage(image.data, image.width, image.height, p, ctx), gpuPixels(p));
    const active = PARAMS.filter((d) => params[d.key] !== d.default);
    return {
      params: Object.fromEntries(active.map((d) => [d.key, params[d.key]])),
      full: diffWith(params),
      withoutEach: Object.fromEntries(
        active.map((d) => [d.key, diffWith({ ...params, [d.key]: d.default }).maxDiff]),
      ),
    };
  },

  tiled(tileSize: number): Comparison[] {
    const renderer = requireGpu();
    return BUILTIN_PRESETS.map((preset) => {
      const cpu = gradeImage(image.data, image.width, image.height, preset.params, ctx);
      const out = new Uint8ClampedArray(image.data.length);
      renderer.renderTiles(image, preset.params, ctx, tileSize, (tile, pixels) => {
        for (let row = 0; row < tile.height; row++) {
          const start = row * tile.width * 4;
          out.set(
            pixels.subarray(start, start + tile.width * 4),
            ((tile.y + row) * image.width + tile.x) * 4,
          );
        }
      });
      return compare(`${preset.id} tiles of ${tileSize}`, cpu, out);
    });
  },

  /** The canvas is flipped relative to textures, so check it shows the image the right way up. */
  canvasOrientation(): Comparison {
    const renderer = requireGpu();
    const params = BUILTIN_PRESETS[1]!.params;
    const memory = gpuPixels(params);
    renderer.renderNow();
    const copy = document.createElement('canvas');
    copy.width = image.width;
    copy.height = image.height;
    const context = copy.getContext('2d')!;
    context.drawImage(glCanvas, 0, 0);
    return compare('canvas', memory, context.getImageData(0, 0, image.width, image.height).data);
  },

  async cpuFallback() {
    const canvas = document.createElement('canvas');
    const renderer = createRenderer(canvas, { forceCpu: true });
    const params = BUILTIN_PRESETS.find((p) => p.params.sharpen > 0)!.params;
    renderer.setImage(image, ctx);
    renderer.setParams(params);
    await renderer.render();
    const drawn = canvas.getContext('2d')!.getImageData(0, 0, image.width, image.height).data;
    const cpu = gradeImage(image.data, image.width, image.height, params, ctx);
    renderer.dispose();
    return { backend: renderer.backend, ...compare('cpu fallback', cpu, drawn) };
  },

  async contextLoss() {
    const canvas = document.createElement('canvas');
    let lost = false;
    const renderer = createRenderer(canvas, { onContextLost: () => (lost = true) });
    const backend = renderer.backend;
    renderer.setImage(image, ctx);
    await renderer.render();
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const replacement = createRenderer(document.createElement('canvas'), { forceCpu: true });
    replacement.setImage(image, ctx);
    await replacement.render();
    const next = replacement.backend;
    replacement.dispose();
    await renderer.render(); // must be harmless on a dead context
    return { backend, lost, next };
  },

  benchmark(width: number, height: number, frames: number) {
    const canvas = document.createElement('canvas');
    const renderer = GradeRenderer.create(canvas);
    if (!renderer) throw new Error('WebGL2 is not available in this browser');
    const noisy = { data: new Uint8ClampedArray(width * height * 4), width, height };
    for (let i = 0; i < noisy.data.length; i++) {
      noisy.data[i] = i % 4 === 3 ? 255 : Math.imul(i, 2654435761) >>> 24;
    }
    renderer.setImage(noisy, contextFor(noisy));
    const params = BUILTIN_PRESETS.find((p) => p.params.sharpen > 0)!.params;
    const start = performance.now();
    for (let f = 0; f < frames; f++) {
      renderer.setParams({ ...params, exposure: f % 100 });
      renderer.renderNow();
      renderer.finish();
    }
    const elapsed = performance.now() - start;
    renderer.dispose();
    return { fps: (frames * 1000) / elapsed, msPerFrame: elapsed / frames };
  },
};

export type Harness = typeof harness;

declare global {
  interface Window {
    harness: Harness;
  }
}

window.harness = harness;
