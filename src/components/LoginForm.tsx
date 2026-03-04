"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function LoginForm() {
  const { login } = useAuth();
  const { trackFormStart, trackFormFieldFocus, trackFormSubmit, trackAuthSubmit, trackAuthClick } =
    useAnalytics();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formStarted, setFormStarted] = useState(false);

  // Track form start when user first interacts
  useEffect(() => {
    if (!formStarted && (formData.email || formData.password)) {
      trackFormStart("login");
      setFormStarted(true);
    }
  }, [formData, formStarted, trackFormStart]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(formData);
      trackAuthSubmit("login", true);
      trackFormSubmit("login", true);
      // Usar recarga completa para asegurar que el estado se actualice correctamente
      window.location.href = "/";
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al iniciar sesión";
      trackAuthSubmit("login", false, errorMessage);
      trackFormSubmit("login", false, errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Iniciar Sesión</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            onFocus={() => trackFormFieldFocus("login", "email")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => trackAuthClick("forgot_password")}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            onFocus={() => trackFormFieldFocus("login", "password")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        ¿No tienes cuenta?{" "}
        <Link
          href="/register"
          className="text-blue-600 hover:text-blue-800 font-medium"
          onClick={() => trackAuthClick("register")}
        >
          Regístrate aquí
        </Link>
      </p>
    </div>
  );
}
