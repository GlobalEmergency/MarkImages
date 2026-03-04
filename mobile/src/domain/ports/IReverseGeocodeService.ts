import { Coordinates } from "../models/Location";

export interface ReverseGeocodeResult {
  streetName: string;
  streetNumber: string;
  postalCode: string;
}

export interface IReverseGeocodeService {
  reverse(coords: Coordinates, signal?: AbortSignal): Promise<ReverseGeocodeResult | null>;
}
