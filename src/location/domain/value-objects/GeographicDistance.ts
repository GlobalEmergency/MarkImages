/**
 * Geographic Distance Value Object
 *
 * Encapsulates geographic distance calculations using Haversine formula
 */

export class GeographicDistance {
  private static readonly EARTH_RADIUS_KM = 6371;
  private static readonly EARTH_RADIUS_METERS = 6371000;

  /**
   * Calculate distance between two coordinates using Haversine formula
   *
   * @param lat1 Latitude of point 1 (degrees)
   * @param lng1 Longitude of point 1 (degrees)
   * @param lat2 Latitude of point 2 (degrees)
   * @param lng2 Longitude of point 2 (degrees)
   * @returns Distance in meters
   */
  static calculateDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_METERS * c;
  }

  /**
   * Calculate distance in kilometers
   */
  static calculateDistanceInKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    return this.calculateDistanceInMeters(lat1, lng1, lat2, lng2) / 1000;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
