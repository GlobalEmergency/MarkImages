import { Coordinates } from "../models/Location";

export interface IGeolocationService {
  getCurrentPosition(): Promise<Coordinates>;
  requestPermission(): Promise<boolean>;
  checkPermission(): Promise<boolean>;
}
