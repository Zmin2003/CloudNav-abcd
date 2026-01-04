import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants';

/**
 * 认证管理 Hook
 * 处理用户认证状态和令牌管理
 */
export function useAuth() {
  const [authToken, setAuthToken] = useState<string>('');
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const isAuthenticated = !!authToken;

  // 从本地存储加载认证令牌
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (savedToken) {
      setAuthToken(savedToken);
    }
  }, []);

  // 登录
  const login = useCallback((token: string) => {
    setAuthToken(token);
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }, []);

  // 登出
  const logout = useCallback(() => {
    setAuthToken('');
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }, []);

  // 检查是否需要认证
  const checkAuthRequired = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/storage');
      if (response.status === 401) {
        const data = await response.json();
        const needsAuth = data.requiresAuth === true;
        setRequiresAuth(needsAuth);
        return needsAuth;
      }
      setRequiresAuth(false);
      return false;
    } catch (error) {
      console.error('Error checking auth:', error);
      setRequiresAuth(false);
      return false;
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  // 验证令牌是否有效
  const validateToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/storage', {
        headers: {
          'x-auth-password': token,
        },
      });

      if (response.status === 401) {
        // 检查是否是密码过期
        try {
          const errorData = await response.json();
          if (errorData.error && errorData.error.includes('过期')) {
            return false;
          }
        } catch {
          // 忽略解析错误
        }
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }, []);

  return {
    authToken,
    isAuthenticated,
    requiresAuth,
    isCheckingAuth,
    setIsCheckingAuth,
    setRequiresAuth,
    login,
    logout,
    checkAuthRequired,
    validateToken,
  };
}
