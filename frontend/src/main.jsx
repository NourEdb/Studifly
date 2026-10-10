import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { TimerProvider } from './context/TimerContext';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import './index.css';

// Vite wraps every dynamically-imported/preloaded chunk and dispatches this
// event if the fetch fails — the exact failure mode of a browser tab still
// holding an old index.html that references a JS chunk hash the latest
// deploy no longer has. Reloading picks up the new deploy's fresh index.html
// and chunk hashes. Guarded to once per tab session so a chunk that's still
// missing after a reload (a genuine network issue, not staleness) doesn't
// reload-loop forever.
window.addEventListener('vite:preloadError', () => {
  const key = 'studifly_chunk_reload';
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <TimerProvider>
              <App />
              <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }} />
            </TimerProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
