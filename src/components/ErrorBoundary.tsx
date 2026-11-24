import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0d10] p-6 text-stone-100">
          <div className="w-full max-w-md border border-red-800/60 bg-[#14171c] p-6 rounded-lg shadow-2xl">
            <h2 className="font-display text-2xl font-bold tracking-wide text-red-400">
              Survival Session Interrupted
            </h2>
            <p className="mt-2 text-sm text-stone-300 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm rounded transition-colors"
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
