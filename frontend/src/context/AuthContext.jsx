import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/authApi";
import { clearAccessToken, getAccessToken, setAccessToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const response = await authApi.getCurrentUser();
        setUser(response.user);
      } catch {
        clearAccessToken();
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const clearInvalidSession = () => setUser(null);
    window.addEventListener("payroll:unauthorized", clearInvalidSession);
    return () => window.removeEventListener("payroll:unauthorized", clearInvalidSession);
  }, []);

  const signIn = async (credentials) => {
    const response = await authApi.login(credentials);
    setAccessToken(response.accessToken);
    setUser(response.user);
    return response.user;
  };

  const signOut = async () => {
    try {
      if (getAccessToken()) await authApi.logout();
    } finally {
      clearAccessToken();
      setUser(null);
    }
  };

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The hook intentionally shares this module with its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
