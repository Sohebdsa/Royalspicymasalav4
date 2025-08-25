export const authService = {
  login: async (credentials) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials)
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Login failed');
    }
    return response.json();
  },
  logout: async () => {
    await fetch('http://localhost:5000/api/admin/admin-logout', {
      method: 'POST',
      credentials: 'include'
    });
  },
  checkAuth: async () => {
    const response = await fetch('/api/auth/check', {
      credentials: 'include'
    });
    if (!response.ok) {
      return { authenticated: false };
    }
    return response.json();
  }
};
