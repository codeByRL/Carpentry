import API from './api';

export const authService = {
  login: async (credentials) => {
    const response = await API.post('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      return null;
    }
  },

  getToken: () => {
    return localStorage.getItem('token');
  }
};