import axios from 'axios';
import { ENV } from '../../config/env';
import { tokenStorage } from '../auth/tokenStorage';


import { isHandAIMode } from '../../config/appMode';

// eslint-disable-next-line import/no-named-as-default-member
const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 60000,
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.request.use(
  async (config) => {
    config.baseURL = ENV.API_BASE_URL;
    const token = await tokenStorage.getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // For FormData requests (e.g. image upload), ensure Content-Type is NOT set
    // so React Native / OkHttp automatically generates multipart/form-data with boundary!
    const isFormData = config.data && (
      config.data instanceof FormData ||
      typeof config.data.append === 'function' ||
      Boolean(config.data._parts)
    );
    if (isFormData && config.headers) {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      }
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
    // Generate or preserve X-Request-ID for end-to-end traceability
    if (!config.headers['X-Request-ID']) {
      const generatedReqId = 'req_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      config.headers['X-Request-ID'] = generatedReqId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    const resReqId = response.headers?.['x-request-id'] || response.headers?.['X-Request-ID'];
    if (resReqId && response.data && typeof response.data === 'object' && !response.data.requestId) {
      response.data.requestId = resReqId;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401) {
      if (isHandAIMode()) {
        console.warn('[HAND_AI][API] 401 received in HAND_AI mode. Bypassing token refresh and login redirect; remaining in current flow.');
        return Promise.reject(error);
      }

      if (!originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        // Optionally redirect to login or clear auth context here
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${ENV.API_BASE_URL}/auth/refresh`, { refreshToken });
        const data = response.data;
        await tokenStorage.saveTokens(data.accessToken, data.refreshToken);
        
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
        
        processQueue(null, data.accessToken);
        isRefreshing = false;
        
        return apiClient(originalRequest); // Retry original request once
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        await tokenStorage.clearTokens();
        // Redirect to login handled by AuthContext
        return Promise.reject(refreshError);
      }
    }
  }

    return Promise.reject(error);
  }
);

export default apiClient;
