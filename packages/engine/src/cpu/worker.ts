import type { Params } from '../schema';
import type { GradeContext } from '../types';
import { gradeImage } from './grade';

export type WorkerRequest =
  | { type: 'image'; data: Uint8ClampedArray; width: number; height: number; ctx: GradeContext }
  | { type: 'render'; id: number; params: Params };

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

scope.onmessage = ({ data: message }) => {
  if (message.type === 'image') {
    image = message;
    return;
  }
  if (!image) return;
  const data = gradeImage(image.data, image.width, image.height, message.params, image.ctx);
  scope.postMessage({ id: message.id, data }, [data.buffer]);
};
