import { createRenderer } from '@prompt-grader/engine/renderer';
import { useEffect } from 'react';
import { editorStore } from '../../store/editorStore';

/** Drives the renderer from the store directly, so drawing never waits for a React render. */
export function useRenderer(
  canvas: HTMLCanvasElement | null,
  forceCpu: boolean,
  onContextLost: () => void,
): void {
  useEffect(() => {
    if (!canvas) return;
    const renderer = createRenderer(canvas, { forceCpu, onContextLost });
    const { image, params } = editorStore.getState();
    renderer.setParams(params);
    if (image) renderer.setImage(image.preview, image.ctx);

    const unsubscribe = editorStore.subscribe((state, previous) => {
      if (state.image && state.image !== previous.image) {
        renderer.setImage(state.image.preview, state.image.ctx);
      }
      if (state.params !== previous.params) renderer.setParams(state.params);
    });
    return () => {
      unsubscribe();
      renderer.dispose();
    };
  }, [canvas, forceCpu, onContextLost]);
}
