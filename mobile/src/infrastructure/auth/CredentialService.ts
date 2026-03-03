import { Capacitor } from "@capacitor/core";
import { SavePassword } from "capacitor-ios-autofill-save-password";

/**
 * Prompts the native credential manager to save username/password.
 * - iOS: uses capacitor-ios-autofill-save-password to show the save dialog
 * - Android: the WebView's built-in autofill service handles this automatically
 *   via the HTML form autocomplete attributes
 * - Web: browsers handle this natively through the form submission
 */
export async function promptSaveCredentials(username: string, password: string): Promise<void> {
  try {
    if (Capacitor.getPlatform() === "ios") {
      await SavePassword.promptDialog({ username, password });
    }
    // Android and Web handle credential saving automatically
    // through the form's autocomplete attributes
  } catch {
    // Silently fail — saving credentials is best-effort
  }
}
