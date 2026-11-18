import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { firebaseConfig } from '../lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      isQuotaError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'An unexpected error occurred.';
    let friendly = raw;
    let isQuotaError = raw.toLowerCase().includes('quota exceeded');

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === 'string') {
        friendly = `${parsed.operationType?.toUpperCase() || 'DATA'} error on ${
          parsed.path || 'database'
        }: ${parsed.error}`;
        isQuotaError = parsed.error.toLowerCase().includes('quota exceeded');
      }
    } catch {
      // Plain error message
    }

    return {
      hasError: true,
      message: friendly,
      isQuotaError,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Math Speedster ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '', isQuotaError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const upgradeUrl =
      firebaseConfig?.projectId && firebaseConfig?.firestoreDatabaseId
        ? `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`
        : null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h1 className="font-display text-lg font-bold">
              Something went wrong
            </h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
            {this.state.message}
          </p>
          {this.state.isQuotaError && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              The daily Firestore free-tier quota resets tomorrow. Local practice
              remains available.{' '}
              {upgradeUrl && (
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-blue-600 dark:text-blue-400"
                >
                  Open Firestore console
                </a>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Return to Math Speedster
          </button>
        </div>
      </div>
    );
  }
}
