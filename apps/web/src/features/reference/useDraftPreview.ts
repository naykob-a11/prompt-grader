import type { Params, Renderer } from '@prompt-grader/engine';
import { createRenderer } from '@prompt-grader/engine/renderer';
import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../../store/editorStore';

/** Draws the open image with the draft's parameters, apart from the main stage. */
export function useDraftPreview(canvas: HTMLCanvasElement | null, params: Params | null): void {
  const image = useEditor((s) => s.image);
  const [forceCpu, setForceCpu] = useState(false);
  const renderer = useRef<Renderer | null>(null);

  useEffect(() => {
    if (!canvas) return;
    const created = createRenderer(canvas, { forceCpu, onContextLost: () => setForceCpu(true) });
    renderer.current = created;
    return () => {
      renderer.current = null;
      created.dispose();
    };
  }, [canvas, forceCpu]);

  useEffect(() => {
    if (image) renderer.current?.setImage(image.preview, image.ctx);
  }, [canvas, forceCpu, image]);

  useEffect(() => {
    if (params) renderer.current?.setParams(params);
  }, [canvas, forceCpu, image, params]);
}
