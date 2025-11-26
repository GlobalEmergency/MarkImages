/**
 * AED (Automated External Defibrillator) Types
 */

export interface Aed {
  id: string;
  code: string;
  name: string;
  establishment_type: string;
  latitude: number;
  longitude: number;
  published_at: string | null;
  location: {
    street_type: string;
    street_name: string;
    street_number: string | null;
    postal_code: string;
    district: {
      name: string;
    };
  };
  schedule: {
    has_24h_surveillance: boolean;
    weekday_opening: string | null;
    weekday_closing: string | null;
  } | null;
  responsible: {
    name: string;
    email: string;
    phone: string | null;
  };
}

export interface AedsResponse {
  success: boolean;
  data: Aed[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AedFilters {
  page?: number;
  limit?: number;
  search?: string;
}
