import React from 'react'
import ReactDOM from 'react-dom/client'
import 'webrtc-adapter'
import App from './App.jsx'
import './index.css'

if (import.meta.env.PROD) {
  console.log = () => {}
  console.error = (message) => {
    if (message?.toString().includes('eyJh')) {
      console.warn('Security: Blocked')
    }
  }
}

// React.StrictMode is disabled here to avoid double-running side effects in development.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
