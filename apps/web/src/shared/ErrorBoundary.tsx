import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  message: string | null;
}

/** Without this, an error during rendering leaves an empty page and no way to report it. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render() {
    const { message } = this.state;
    if (message === null) return this.props.children;
    return (
      <div className="boot" role="alert">
        <h1>{t('crash.title')}</h1>
        <p>{t('crash.hint')}</p>
        <code>{message}</code>
        <button type="button" className="primary" onClick={() => location.reload()}>
          {t('crash.reload')}
        </button>
      </div>
    );
  }
}
