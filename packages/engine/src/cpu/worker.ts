import type { Params } from '../schema';
import type { Tile } from '../tiles';
import type { GradeContext } from '../types';
import { gradeImage, gradeStrip } from './grade';

export type WorkerRequest =
  | { type: 'image'; data: Uint8ClampedArray; width: number; height: number; ctx: GradeContext }
  | { type: 'render'; id: number; params: Params }
  | {
      type: 'strip';
      id: number;
      region: Uint8ClampedArray;
      strip: Tile;
      params: Params;
      ctx: GradeContext;
    };

export interface WorkerResponse {
  id: number;
  data: Uint8ClampedArray;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
let image: Extract<WorkerRequest, { type: 'image' }> | null = null;

function reply(id: number, data: Uint8ClampedArray): void {
  scope.postMessage({ id, data }, [data.buffer]);
}

scope.onmessage = ({ data: message }) => {
  if (message.type === 'image') {
    image = message;
  } else if (message.type === 'strip') {
    const { id, region, strip, params, ctx } = message;
    reply(id, gradeStrip(region, strip, params, ctx));
  } else if (image) {
    const { data, width, height, ctx } = image;
    reply(message.id, gradeImage(data, width, height, message.params, ctx));
  }
};
