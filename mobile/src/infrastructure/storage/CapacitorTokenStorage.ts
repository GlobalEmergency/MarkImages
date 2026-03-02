import { Preferences } from "@capacitor/preferences";

import { ITokenStorage } from "../../domain/ports/ITokenStorage";

const TOKEN_KEY = "auth-token";

export class CapacitorTokenStorage implements ITokenStorage {
  async getToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value;
  }

  async setToken(token: string): Promise<void> {
    await Preferences.set({ key: TOKEN_KEY, value: token });
  }

  async removeToken(): Promise<void> {
    await Preferences.remove({ key: TOKEN_KEY });
  }
}
