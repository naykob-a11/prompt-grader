import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

const DURATION_MS = 5000;

const toastStore = createStore<{ toasts: Toast[] }>()(() => ({ toasts: [] }));
let nextId = 0;

export function showToast(message: string, tone: Toast['tone'] = 'info'): void {
  const id = ++nextId;
  toastStore.setState((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
  setTimeout(() => {
    toastStore.setState((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) }));
  }, DURATION_MS);
}

export function Toasts() {
  const toasts = useStore(toastStore, (s) => s.toasts);
  return (
    <div className="toasts" role="status">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" data-tone={toast.tone}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
