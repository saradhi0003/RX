import React from "react";

/**
 * App-level error boundary — a render error in any page no longer
 * white-screens the whole app. Shows a branded fallback with recovery
 * actions and logs the error for diagnostics.
 *
 * Class component by necessity: componentDidCatch has no hook equivalent.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Central log point — swap for Sentry/etc. when wired (GAPS.md E10).
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ error: null });
    window.location.href = "/Dashboard";
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl" role="img" aria-label="error">⚠️</span>
          </div>
          <h1 className="text-lg font-bold text-[#0F172A] mb-2">Something went wrong</h1>
          <p className="text-sm text-[#64748B] mb-1">
            The page hit an unexpected error. Your data is safe.
          </p>
          <p className="text-xs text-[#94A3B8] font-mono bg-[#F8FAFC] rounded-lg px-3 py-2 mt-3 mb-5 break-words">
            {String(this.state.error?.message || this.state.error).slice(0, 200)}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white text-sm font-medium"
            >
              Reload page
            </button>
            <button
              onClick={this.handleHome}
              className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-[#0F172A] text-sm font-medium hover:bg-[#F8FAFC]"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
