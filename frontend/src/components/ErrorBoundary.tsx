import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-slate-700 dark:text-slate-300">
          <p className="text-lg font-semibold">Algo deu errado. Recarregue a página.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-club-red text-white font-bold rounded-lg px-5 py-2 text-sm hover:opacity-90"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
