"use client";

import { useCallback } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Check if Google Analytics is available and not blocked
 * This handles cases where:
 * - User has ad blockers
 * - Privacy extensions block gtag
 * - GA script failed to load
 */
function isGtagAvailable(): boolean {
  if (typeof window === "undefined") return false;

  // Check if gtag exists and is a function
  if (typeof window.gtag !== "function") return false;

  // Additional check: try to verify GA is actually functional
  // Some blockers replace gtag with a no-op function
  try {
    // If dataLayer exists, GA is likely functional
    return Array.isArray((window as { dataLayer?: unknown[] }).dataLayer);
  } catch {
    return false;
  }
}

// Categorías de eventos para organizar el tracking
export const AnalyticsCategory = {
  NAVIGATION: "navigation",
  MAP: "map",
  SEARCH: "search",
  DEA: "dea",
  AUTH: "auth",
  FORM: "form",
  EXTERNAL_LINK: "external_link",
  FOOTER: "footer",
  UI: "ui",
} as const;

export type AnalyticsCategoryType = (typeof AnalyticsCategory)[keyof typeof AnalyticsCategory];

// Tipos de eventos personalizados
export interface AnalyticsEvent {
  action: string;
  category: AnalyticsCategoryType;
  label?: string;
  value?: number;
  // Parámetros adicionales para eventos específicos
  [key: string]: unknown;
}

/**
 * Hook para enviar eventos a Google Analytics
 * Diseñado para tracking detallado de interacciones públicas
 *
 * Handles cases where GA is blocked by:
 * - Ad blockers (uBlock, AdBlock Plus, etc.)
 * - Privacy extensions (Privacy Badger, Ghostery)
 * - Browser privacy settings
 * - Script loading failures
 */
export function useAnalytics() {
  /**
   * Envía un evento personalizado a GA4
   * Silently fails if GA is not available (blocked or not loaded)
   */
  const trackEvent = useCallback((event: AnalyticsEvent) => {
    if (!isGtagAvailable()) {
      // Silently skip - GA is blocked or unavailable
      // Optionally log in development:
      // if (process.env.NODE_ENV === "development") {
      //   console.debug("[Analytics] GA not available, skipping event:", event.action);
      // }
      return;
    }

    try {
      const { action, category, label, value, ...additionalParams } = event;

      window.gtag!("event", action, {
        event_category: category,
        event_label: label,
        value: value,
        ...additionalParams,
      });
    } catch {
      // Silently fail - don't break the app if GA throws
    }
  }, []);

  // =====================
  // EVENTOS DE NAVEGACIÓN
  // =====================

  const trackNavClick = useCallback(
    (linkName: string, destination: string) => {
      trackEvent({
        action: "nav_click",
        category: AnalyticsCategory.NAVIGATION,
        label: linkName,
        destination: destination,
      });
    },
    [trackEvent]
  );

  const trackLogoClick = useCallback(() => {
    trackEvent({
      action: "logo_click",
      category: AnalyticsCategory.NAVIGATION,
      label: "logo",
    });
  }, [trackEvent]);

  const trackMobileMenuToggle = useCallback(
    (isOpen: boolean) => {
      trackEvent({
        action: "mobile_menu_toggle",
        category: AnalyticsCategory.NAVIGATION,
        label: isOpen ? "open" : "close",
      });
    },
    [trackEvent]
  );

  // =====================
  // EVENTOS DEL MAPA
  // =====================

  const trackMapInteraction = useCallback(
    (interactionType: "zoom" | "pan" | "marker_click" | "cluster_click", details?: string) => {
      trackEvent({
        action: `map_${interactionType}`,
        category: AnalyticsCategory.MAP,
        label: details,
      });
    },
    [trackEvent]
  );

  const trackMarkerClick = useCallback(
    (deaId: string, deaName: string) => {
      trackEvent({
        action: "marker_click",
        category: AnalyticsCategory.MAP,
        label: deaName,
        dea_id: deaId,
      });
    },
    [trackEvent]
  );

  // =====================
  // EVENTOS DE BÚSQUEDA
  // =====================

  const trackSearch = useCallback(
    (searchType: "address" | "geolocation", query?: string) => {
      trackEvent({
        action: "search",
        category: AnalyticsCategory.SEARCH,
        label: searchType,
        search_query: query,
      });
    },
    [trackEvent]
  );

  const trackSearchSuggestionClick = useCallback(
    (suggestionIndex: number, suggestionText: string) => {
      trackEvent({
        action: "search_suggestion_click",
        category: AnalyticsCategory.SEARCH,
        label: suggestionText,
        value: suggestionIndex,
      });
    },
    [trackEvent]
  );

  const trackGeolocationRequest = useCallback(
    (result: "success" | "denied" | "error") => {
      trackEvent({
        action: "geolocation_request",
        category: AnalyticsCategory.SEARCH,
        label: result,
      });
    },
    [trackEvent]
  );

  const trackSearchClear = useCallback(() => {
    trackEvent({
      action: "search_clear",
      category: AnalyticsCategory.SEARCH,
    });
  }, [trackEvent]);

  // =====================
  // EVENTOS DE DEA
  // =====================

  const trackDeaCardClick = useCallback(
    (deaId: string, deaName: string, position: number) => {
      trackEvent({
        action: "dea_card_click",
        category: AnalyticsCategory.DEA,
        label: deaName,
        dea_id: deaId,
        position: position,
      });
    },
    [trackEvent]
  );

  const trackDeaModalOpen = useCallback(
    (deaId: string, deaName: string) => {
      trackEvent({
        action: "dea_modal_open",
        category: AnalyticsCategory.DEA,
        label: deaName,
        dea_id: deaId,
      });
    },
    [trackEvent]
  );

  const trackDeaModalClose = useCallback(
    (deaId: string, closeMethod: "button" | "backdrop" | "escape") => {
      trackEvent({
        action: "dea_modal_close",
        category: AnalyticsCategory.DEA,
        label: closeMethod,
        dea_id: deaId,
      });
    },
    [trackEvent]
  );

  const trackDeaImageView = useCallback(
    (deaId: string, imageIndex: number, totalImages: number) => {
      trackEvent({
        action: "dea_image_view",
        category: AnalyticsCategory.DEA,
        dea_id: deaId,
        image_index: imageIndex,
        total_images: totalImages,
      });
    },
    [trackEvent]
  );

  const trackDeaPhoneClick = useCallback(
    (deaId: string, phoneNumber: string) => {
      trackEvent({
        action: "dea_phone_click",
        category: AnalyticsCategory.DEA,
        label: "phone_call",
        dea_id: deaId,
        phone_number: phoneNumber,
      });
    },
    [trackEvent]
  );

  // =====================
  // EVENTOS DE AUTH
  // =====================

  const trackAuthClick = useCallback(
    (authType: "login" | "register" | "logout" | "forgot_password") => {
      trackEvent({
        action: `auth_${authType}_click`,
        category: AnalyticsCategory.AUTH,
        label: authType,
      });
    },
    [trackEvent]
  );

  const trackAuthSubmit = useCallback(
    (authType: "login" | "register", success: boolean, errorMessage?: string) => {
      trackEvent({
        action: `auth_${authType}_submit`,
        category: AnalyticsCategory.AUTH,
        label: success ? "success" : "error",
        error_message: errorMessage,
      });
    },
    [trackEvent]
  );

  // =====================
  // EVENTOS DE FORMULARIOS
  // =====================

  const trackFormStart = useCallback(
    (formName: string) => {
      trackEvent({
        action: "form_start",
        category: AnalyticsCategory.FORM,
        label: formName,
      });
    },
    [trackEvent]
  );

  const trackFormFieldFocus = useCallback(
    (formName: string, fieldName: string) => {
      trackEvent({
        action: "form_field_focus",
        category: AnalyticsCategory.FORM,
        label: `${formName}_${fieldName}`,
        form_name: formName,
        field_name: fieldName,
      });
    },
    [trackEvent]
  );

  const trackFormSubmit = useCallback(
    (formName: string, success: boolean, errorMessage?: string) => {
      trackEvent({
        action: "form_submit",
        category: AnalyticsCategory.FORM,
        label: formName,
        success: success,
        error_message: errorMessage,
      });
    },
    [trackEvent]
  );

  const trackFormAbandon = useCallback(
    (formName: string, lastFieldFilled: string) => {
      trackEvent({
        action: "form_abandon",
        category: AnalyticsCategory.FORM,
        label: formName,
        last_field: lastFieldFilled,
      });
    },
    [trackEvent]
  );

  // =====================
  // EVENTOS DE ENLACES EXTERNOS
  // =====================

  const trackExternalLink = useCallback(
    (url: string, linkText: string, location: string) => {
      trackEvent({
        action: "external_link_click",
        category: AnalyticsCategory.EXTERNAL_LINK,
        label: linkText,
        url: url,
        click_location: location,
      });
    },
    [trackEvent]
  );

  // =====================
  // EVENTOS DE FOOTER
  // =====================

  const trackFooterClick = useCallback(
    (linkName: string, destination: string) => {
      trackEvent({
        action: "footer_click",
        category: AnalyticsCategory.FOOTER,
        label: linkName,
        destination: destination,
      });
    },
    [trackEvent]
  );

  // =====================
  // EVENTOS DE UI GENERAL
  // =====================

  const trackButtonClick = useCallback(
    (buttonName: string, location: string) => {
      trackEvent({
        action: "button_click",
        category: AnalyticsCategory.UI,
        label: buttonName,
        click_location: location,
      });
    },
    [trackEvent]
  );

  const trackModalOpen = useCallback(
    (modalName: string) => {
      trackEvent({
        action: "modal_open",
        category: AnalyticsCategory.UI,
        label: modalName,
      });
    },
    [trackEvent]
  );

  const trackModalClose = useCallback(
    (modalName: string, closeMethod: "button" | "backdrop" | "escape") => {
      trackEvent({
        action: "modal_close",
        category: AnalyticsCategory.UI,
        label: modalName,
        close_method: closeMethod,
      });
    },
    [trackEvent]
  );

  const trackScroll = useCallback(
    (section: string, percentage: number) => {
      trackEvent({
        action: "scroll",
        category: AnalyticsCategory.UI,
        label: section,
        value: percentage,
      });
    },
    [trackEvent]
  );

  const trackResultsPanelToggle = useCallback(
    (isOpen: boolean) => {
      trackEvent({
        action: "results_panel_toggle",
        category: AnalyticsCategory.UI,
        label: isOpen ? "open" : "close",
      });
    },
    [trackEvent]
  );

  return {
    // Evento genérico
    trackEvent,

    // Navegación
    trackNavClick,
    trackLogoClick,
    trackMobileMenuToggle,

    // Mapa
    trackMapInteraction,
    trackMarkerClick,

    // Búsqueda
    trackSearch,
    trackSearchSuggestionClick,
    trackGeolocationRequest,
    trackSearchClear,

    // DEA
    trackDeaCardClick,
    trackDeaModalOpen,
    trackDeaModalClose,
    trackDeaImageView,
    trackDeaPhoneClick,

    // Auth
    trackAuthClick,
    trackAuthSubmit,

    // Formularios
    trackFormStart,
    trackFormFieldFocus,
    trackFormSubmit,
    trackFormAbandon,

    // Enlaces externos
    trackExternalLink,

    // Footer
    trackFooterClick,

    // UI General
    trackButtonClick,
    trackModalOpen,
    trackModalClose,
    trackScroll,
    trackResultsPanelToggle,
  };
}

/**
 * Función helper para usar fuera de componentes React
 * Silently fails if GA is not available
 */
export function trackEventDirect(event: AnalyticsEvent) {
  if (!isGtagAvailable()) {
    return;
  }

  try {
    const { action, category, label, value, ...additionalParams } = event;

    window.gtag!("event", action, {
      event_category: category,
      event_label: label,
      value: value,
      ...additionalParams,
    });
  } catch {
    // Silently fail
  }
}
