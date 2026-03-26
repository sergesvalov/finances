import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api', // For local dev, in production usually just /api
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
