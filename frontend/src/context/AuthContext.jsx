import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Always fetches the full profile via getMe() rather than trusting whatever
  // shape the login/register REST response happens to hand back — that
  // response is intentionally minimal ({ id, username, email }, see
  // auth.service.js's login()) and was missing fields like meeting_link,
  // display_name, and every other setting, leaving `user` under-populated
  // until the next page refresh or a Settings save (which does call
  // refreshUser()). This keeps `user` as a single consistent shape everywhere,
  // from the moment of login, not just after a refresh.
  async function loginUser(token) {
    localStorage.setItem('token', token);
    const fullUser = await getMe();
    setUser(fullUser);
    return fullUser;
  }

  function logoutUser() {
    localStorage.removeItem('token');
    setUser(null);
  }

  async function refreshUser() {
    const updated = await getMe();
    setUser(updated);
    return updated;
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
