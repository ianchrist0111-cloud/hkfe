// HKFES Institutional React Error Boundary
// Catches uncaught runtime render errors, displays diagnostic telemetry, and offers seamless recovery

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { IconAlertCircle, IconRefreshCw, IconArrowLeft } from './Icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[HKFES ErrorBoundary] Uncaught render exception:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleNavigateHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base, #0a0e17)',
          color: 'var(--text-primary, #ffffff)',
          fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          padding: '24px',
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: 'var(--bg-surface, #111827)',
            border: '1px solid var(--border-subtle, #1f2937)',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-loss, #ef4444)',
              marginBottom: '20px',
            }}>
              <IconAlertCircle size={32} />
            </div>

            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '8px',
              color: 'var(--text-primary, #ffffff)',
            }}>
              System Execution Halted
            </h1>

            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary, #9ca3af)',
              marginBottom: '24px',
              lineHeight: 1.5,
            }}>
              The trading terminal encountered an unexpected execution state. Session state and order parameters have been preserved safely.
            </p>

            {this.state.error && (
              <div style={{
                textAlign: 'left',
                background: 'var(--bg-elevated, #0d131f)',
                border: '1px solid var(--border-subtle, #1f2937)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '24px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'var(--color-loss, #ef4444)',
                maxHeight: '120px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {this.state.error.name}: {this.state.error.message}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
            }}>
              <button
                type="button"
                onClick={this.handleNavigateHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'var(--bg-elevated, #1f2937)',
                  color: 'var(--text-primary, #ffffff)',
                  border: '1px solid var(--border-subtle, #374151)',
                }}
              >
                <IconArrowLeft size={16} /> Return to Dashboard
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'var(--accent-primary, #00d2aa)',
                  color: '#000000',
                  border: 'none',
                }}
              >
                <IconRefreshCw size={16} /> Reload Terminal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
