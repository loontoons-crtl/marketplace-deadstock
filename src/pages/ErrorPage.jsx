import { Component } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start px-4 py-20">
      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted">
        Error 404
      </span>
      <h1 className="serif-title mt-5 text-5xl text-ink sm:text-6xl">
        We couldn’t find that page.
      </h1>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
        The link may be outdated, the listing may have sold out, or the address might have a typo.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="btn btn-primary rounded-full px-6">
          Go to homepage
        </Link>
        <Link to="/search" className="btn btn-outline rounded-full px-6">
          Browse materials
        </Link>
        <Link to="/sell" className="px-4 py-2 text-sm font-medium text-muted hover:text-ink">
          Sell your stock →
        </Link>
      </div>
    </main>
  );
}

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-start px-4 py-20">
        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium uppercase tracking-widest text-red-700">
          Something went wrong
        </span>
        <h1 className="serif-title mt-5 text-5xl text-ink">
          This page hit an unexpected error.
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
          Please refresh the page to try again, or return to the homepage.
        </p>
        {this.state.error?.message && (
          <p className="mt-4 rounded-md border border-line bg-white px-3 py-2 font-mono text-xs text-muted">
            {this.state.error.message}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary rounded-full px-6"
          >
            Reload page
          </button>
          <a href="/" className="btn btn-outline rounded-full px-6">
            Go home
          </a>
        </div>
      </main>
    );
  }
}
