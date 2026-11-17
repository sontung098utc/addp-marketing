import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Bộ bắt lỗi Error Boundary để hiển thị chi tiết lỗi nếu React bị crash
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          background: '#0c0d12',
          color: '#ef4444',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '32px',
            borderRadius: '16px',
            maxWidth: '600px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: '700' }}>⚠️ Phát hiện lỗi kết xuất giao diện</h2>
            <p style={{
              background: '#15171e',
              padding: '16px',
              borderRadius: '8px',
              color: '#f87171',
              fontFamily: 'monospace',
              fontSize: '13px',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {this.state.error ? this.state.error.toString() : 'Unknown Error'}
            </p>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }} 
              style={{
                marginTop: '24px',
                padding: '12px 24px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              Reset dữ liệu tạm thời (Clear Cache) & Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
