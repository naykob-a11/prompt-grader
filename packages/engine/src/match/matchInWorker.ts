import type { Params } from '../schema';
import type { RawImage } from '../types';
import type { MatchRequest } from './worker';

/** Runs matchTone away from the main thread, on thumbnails of at most MATCH_SIDE. */
export function matchToneInWorker(source: RawImage, reference: RawImage): Promise<Params> {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return new Promise<Params>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<Params>) => resolve(data);
    worker.onerror = () => reject(new Error('tone match failed'));
    const message: MatchRequest = { source, reference };
    worker.postMessage(message);
  }).finally(() => worker.terminate());
}
