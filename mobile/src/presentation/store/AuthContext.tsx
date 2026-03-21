import React, { createContext, useCallback, useEffect, useState } from "react";

import { UserPublic } from "../../domain/models/User";
import {
  authRepository,
  crashReporter,
  loginUseCase,
  registerUseCase,
  checkSessionUseCase,
} from "../../infrastructure/di/container";

export interface AuthContextValue {
  user: UserPublic | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkSessionUseCase
      .execute()
      .then((restoredUser) => {
        setUser(restoredUser);
        if (restoredUser) {
          crashReporter.setUserId(restoredUser.id).catch(() => {});
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginUseCase.execute(email, password);
    setUser(result.user);
    crashReporter.setUserId(result.user.id).catch(() => {});
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await registerUseCase.execute(name, email, password);
    setUser(result.user);
    crashReporter.setUserId(result.user.id).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    await authRepository.logout();
    crashReporter.clearUserId().catch(() => {});
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await authRepository.deleteAccount(password);
    crashReporter.clearUserId().catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
