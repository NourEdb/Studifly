import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      // Logged out — tear down any existing connection
      setSocket(prev => {
        prev?.disconnect();
        return null;
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // VITE_SOCKET_URL points at the deployed backend (e.g. Render) — required in
    // production since the frontend (Vercel) and backend are different origins,
    // so there's no same-origin request for a server-side proxy to catch. Left
    // unset locally: io() with no URL connects same-origin, and the Vite dev
    // proxy (vite.config.js) forwards /socket.io → localhost:5000, same as before.
    const socketUrl = import.meta.env.VITE_SOCKET_URL;
    const socketOpts = {
      auth: { token },
      // Polling first, then upgrade to websocket once the connection is
      // confirmed live — more resilient than websocket-first against a
      // cold-starting free-tier host (e.g. Render spinning back up), which a
      // forced-first WS upgrade handles less gracefully than a plain HTTP request.
      transports: ['polling', 'websocket'],
    };
    const s = socketUrl ? io(socketUrl, socketOpts) : io(socketOpts);

    s.on('connect',       ()  => console.log('[socket] connected:', s.id));
    s.on('disconnect',    (r) => console.log('[socket] disconnected:', r));
    s.on('connect_error', (e) => console.error('[socket] connect error:', e.message));

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user?.id]); // re-run only when the logged-in user actually changes

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
