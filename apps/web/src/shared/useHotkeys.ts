import { useEffect } from 'react';

export interface HotkeyHandlers {
  /** Return true when the key was handled. */
  onKeyDown(event: KeyboardEvent): boolean;
  onKeyUp?(event: KeyboardEvent): void;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && target.type !== 'range';
}

/** Global shortcuts, which stay out of the way while the user types in a text field. */
export function useHotkeys(handlers: HotkeyHandlers): void {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      // Ctrl+S and Ctrl+E work from anywhere, including while typing in the prompt.
      const anywhere =
        (event.ctrlKey || event.metaKey) && ['s', 'e'].includes(event.key.toLowerCase());
      if ((anywhere || !isTyping(event.target)) && handlers.onKeyDown(event)) {
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => handlers.onKeyUp?.(event);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [handlers]);
}
