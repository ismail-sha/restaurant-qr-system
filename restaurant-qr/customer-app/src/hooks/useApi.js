import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 10000,
});

export const menuAPI = {
  getAll: () => api.get('/api/menu').then(r => r.data),
};

export const ordersAPI = {
  place: (data) => api.post('/api/orders', data).then(r => r.data),
  getById: (id) => api.get(`/api/orders/${id}`).then(r => r.data),
  getByTable: (tableId) => api.get(`/api/orders/table/${tableId}`).then(r => r.data),
};

export const tablesAPI = {
  getById: (id) => api.get(`/api/tables/${id}`).then(r => r.data),
};

export default api;
