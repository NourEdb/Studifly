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

    // Connect to the same origin; the Vite dev proxy forwards /socket.io → backend.
    // In production a reverse-proxy does the same, so no extra env var is needed.
    const s = io({
      auth: { token },
      // Allow fallback to polling if WS is unavailable (e.g. some firewalls)
      transports: ['websocket', 'polling'],
    });

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
