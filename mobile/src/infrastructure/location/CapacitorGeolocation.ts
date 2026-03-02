import { Geolocation } from "@capacitor/geolocation";

import { Coordinates } from "../../domain/models/Location";

export class CapacitorGeolocationService {
  async getCurrentPosition(): Promise<Coordinates> {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  async requestPermission(): Promise<boolean> {
    try {
      const status = await Geolocation.requestPermissions();
      return status.location === "granted";
    } catch {
      return false;
    }
  }

  async checkPermission(): Promise<boolean> {
    try {
      const status = await Geolocation.checkPermissions();
      return status.location === "granted";
    } catch {
      return false;
    }
  }
}
