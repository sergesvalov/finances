import axios from 'axios';

const api = axios.create({
  // Use relative path '/api' so that in production, the browser calls the same domain 
  // and Nginx seamlessly proxies the request to the backend.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
