import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("rh_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("rh_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("rh_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("rh_token");
    setUser(null);
    window.location.href = "/login";
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
