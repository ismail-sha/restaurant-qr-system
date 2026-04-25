import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('kitchen_token'));
  const [staff, setStaff] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kitchen_staff')); } catch { return null; }
  });

  const login = async (email, password) => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password });
    const { token: t, staff: s } = res.data;
    setToken(t);
    setStaff(s);
    localStorage.setItem('kitchen_token', t);
    localStorage.setItem('kitchen_staff', JSON.stringify(s));
    return s;
  };

  const logout = () => {
    setToken(null);
    setStaff(null);
    localStorage.removeItem('kitchen_token');
    localStorage.removeItem('kitchen_staff');
  };

  return (
    <AuthContext.Provider value={{ token, staff, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
