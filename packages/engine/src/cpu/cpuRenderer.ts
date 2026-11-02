import { DEFAULT_PARAMS, type Params } from '../schema';
import type { GradeContext, RawImage, Renderer } from '../types';
import type { WorkerRequest, WorkerResponse } from './worker';

/** Fallback for browsers without WebGL2: grades in a Web Worker and paints with putImageData. */
export class CpuRenderer implements Renderer {
  readonly backend = 'cpu';

  private readonly worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private readonly context: CanvasRenderingContext2D;
  private params: Params = DEFAULT_PARAMS;
  private size: { width: number; height: number } | null = null;
  private busy = false;
  private dirty = false;
  private nextId = 0;
  private waiting: (() => void)[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas has no 2D context');
    this.context = context;
    this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => this.onResult(data);
  }

  setImage(image: RawImage, ctx: GradeContext): void {
    const data = image.data.slice();
    const message: WorkerRequest = {
      type: 'image',
      data,
      width: image.width,
      height: image.height,
      ctx,
    };
    this.worker.postMessage(message, [data.buffer]);
    this.size = { width: image.width, height: image.height };
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.request();
  }

  setParams(params: Params): void {
    this.params = params;
    this.request();
  }

  render(): Promise<void> {
    if (!this.size) return Promise.resolve();
    return new Promise((resolve) => {
      this.waiting.push(resolve);
      this.request();
    });
  }

  dispose(): void {
    this.worker.terminate();
    for (const resolve of this.waiting) resolve();
    this.waiting = [];
  }

  /** At most one frame is in flight; changes made meanwhile collapse into the next one. */
  private request(): void {
    if (!this.size) return;
    if (this.busy) {
      this.dirty = true;
      return;
    }
    this.busy = true;
    this.dirty = false;
    const message: WorkerRequest = { type: 'render', id: ++this.nextId, params: this.params };
    this.worker.postMessage(message);
  }

  private onResult({ data }: WorkerResponse): void {
    this.busy = false;
    const { width, height } = this.size!;
    this.context.putImageData(new ImageData(data as ImageDataArray, width, height), 0, 0);
    if (this.dirty) {
      this.request();
      return;
    }
    const waiting = this.waiting;
    this.waiting = [];
    for (const resolve of waiting) resolve();
  }
}
