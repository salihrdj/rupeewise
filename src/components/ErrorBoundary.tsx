import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '50vh', padding: '2rem', textAlign: 'center', gap: '1rem',
          color: 'var(--text-primary)'
        }}>
          <AlertTriangle size={48} style={{ color: 'var(--danger)' }} />
          <h2>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button 
            className="btn btn-primary" 
            onClick={this.handleRetry}
          >
            <RefreshCw size={18} /> Try Again
          </button>
          <details style={{ textAlign: 'left', maxWidth: '500px', marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Error Details</summary>
            <pre style={{ 
              marginTop: '0.5rem', padding: '1rem', background: 'var(--bg-card)', 
              borderRadius: 'var(--radius-sm)', overflow: 'auto', fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}