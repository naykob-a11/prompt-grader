import type { Params } from '../schema';
import type { RawImage } from '../types';
import { matchTone } from './toneMatch';

export interface MatchRequest {
  source: RawImage;
  reference: RawImage;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<MatchRequest>) => void) | null;
  postMessage(message: Params): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = ({ data: { source, reference } }) => {
  scope.postMessage(matchTone(source, reference));
};
