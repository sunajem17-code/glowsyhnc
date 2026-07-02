import { Component } from 'react'

const IS_DEV = import.meta.env.DEV

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#0A0A0A',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Something went wrong
        </p>

        {IS_DEV ? (
          <pre
            style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'rgba(255,60,60,0.12)',
              border: '1px solid rgba(255,60,60,0.3)',
              borderRadius: 12,
              color: '#ff6b6b',
              fontSize: 12,
              textAlign: 'left',
              maxWidth: 480,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowY: 'auto',
              maxHeight: 300,
            }}
          >
            {error?.message}
            {'\n'}
            {error?.stack}
          </pre>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 24 }}>
            The app hit an unexpected error. Please restart and try again.
          </p>
        )}

        <button
          onClick={() => window.location.replace('/')}
          style={{
            marginTop: 24,
            padding: '12px 28px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)',
            color: '#0A0A0A',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Restart App
        </button>

        {!IS_DEV && (
          <button
            onClick={() => {
              const body = encodeURIComponent(`Error: ${error?.message}\n\nStack: ${error?.stack}`)
              window.open(`mailto:support@ascendus.store?subject=App%20Crash%20Report&body=${body}`)
            }}
            style={{
              marginTop: 12,
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.35)',
              fontSize: 12,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Report issue
          </button>
        )}
      </div>
    )
  }
}
