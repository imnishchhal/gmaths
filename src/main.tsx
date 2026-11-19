import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root');

if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rootEl.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;"><div style="max-width:420px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;"><h1 style="font-size:18px;font-weight:700;margin:0 0 8px;">Math Speedster could not start</h1><p style="font-size:14px;color:#475569;margin:0;">${message.replace(/</g, '&lt;')}</p></div></div>`;
  }
}
