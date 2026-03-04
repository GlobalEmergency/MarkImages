export function buildNavigationUrl(lat: number, lng: number, name: string): string {
  return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`;
}

export function buildTelUrl(phone: string): string {
  return `tel:${phone}`;
}
