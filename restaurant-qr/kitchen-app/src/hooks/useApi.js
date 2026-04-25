import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: BASE, timeout: 10000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kitchen_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kitchen_token');
      localStorage.removeItem('kitchen_staff');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const ordersAPI = {
  getActive: () => api.get('/api/orders').then(r => r.data),
  updateStatus: (id, status, extra = {}) =>
    api.patch(`/api/orders/${id}/status`, { status, ...extra }).then(r => r.data),
};

export const menuAPI = {
  getAll: () => api.get('/api/menu').then(r => r.data),
  toggleAvailability: (id, is_available) =>
    api.patch(`/api/menu/${id}/availability`, { is_available }).then(r => r.data),
};

export const tablesAPI = {
  getAll: () => api.get('/api/tables').then(r => r.data),
  getQR: (id) => api.get(`/api/tables/${id}/qr`).then(r => r.data),
};

export default api;
