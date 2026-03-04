import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

import { Coordinates } from "../../domain/models/Location";
import { IGeolocationService } from "../../domain/ports/IGeolocationService";

export class CapacitorGeolocationService implements IGeolocationService {
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
      // On native: "granted" means user accepted the dialog
      // On web: "prompt" means the browser will ask when getCurrentPosition() is called
      //         (the web Permissions API cannot programmatically request geolocation)
      return status.location === "granted" || status.location === "prompt";
    } catch {
      // On web, if Permissions API is unavailable, we still try getCurrentPosition
      return !Capacitor.isNativePlatform();
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
