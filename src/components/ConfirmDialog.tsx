"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "red" | "blue" | "green";
  requiresInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmColor = "blue",
  requiresInput = false,
  inputLabel,
  inputPlaceholder,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
      setIsClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleConfirm = () => {
    if (requiresInput && !inputValue.trim()) {
      return;
    }
    setIsClosing(true);
    setTimeout(() => {
      onConfirm(requiresInput ? inputValue.trim() : undefined);
    }, 200);
  };

  const handleCancel = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 200);
  };

  if (!isOpen) return null;

  const colorStyles = {
    red: {
      button: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
      icon: "text-red-500",
      iconBg: "bg-red-100",
    },
    blue: {
      button: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
      icon: "text-blue-500",
      iconBg: "bg-blue-100",
    },
    green: {
      button:
        "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
      icon: "text-green-500",
      iconBg: "bg-green-100",
    },
  };

  const colors = colorStyles[confirmColor];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(circle at center, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.8) 100%)",
        backdropFilter: "blur(8px)",
      }}
      onClick={handleCancel}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl transform transition-all duration-200 ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        style={{
          background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Icon */}
          <div
            className={`w-16 h-16 rounded-full ${colors.iconBg} flex items-center justify-center mb-4`}
          >
            <AlertTriangle className={`w-8 h-8 ${colors.icon}`} />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{title}</h2>

          {/* Message */}
          <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>

          {/* Input (if required) */}
          {requiresInput && (
            <div className="mb-6">
              {inputLabel && (
                <label className="block text-sm font-medium text-gray-700 mb-2">{inputLabel}</label>
              )}
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                rows={3}
                autoFocus
              />
              {requiresInput && !inputValue.trim() && (
                <p className="text-xs text-gray-500 mt-2">* Este campo es obligatorio</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all active:scale-95"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={requiresInput && !inputValue.trim()}
              className={`flex-1 px-6 py-3 ${colors.button} text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
