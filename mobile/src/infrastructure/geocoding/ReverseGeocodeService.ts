import { Coordinates } from "../../domain/models/Location";
import {
  IReverseGeocodeService,
  ReverseGeocodeResult,
} from "../../domain/ports/IReverseGeocodeService";

export type { ReverseGeocodeResult } from "../../domain/ports/IReverseGeocodeService";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

export class ReverseGeocodeService implements IReverseGeocodeService {
  async reverse(coords: Coordinates, signal?: AbortSignal): Promise<ReverseGeocodeResult | null> {
    try {
      const response = await fetch(
        `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`,
        {
          signal,
          headers: { "User-Agent": "DeaMap-Mobile/1.0 (https://deamap.es)" },
        }
      );
      const data = await response.json();

      if (!data.address) return null;

      return {
        streetName: data.address.road || data.address.pedestrian || "",
        streetNumber: data.address.house_number || "",
        postalCode: data.address.postcode || "",
      };
    } catch {
      return null;
    }
  }
}
