/**
 * DuplicateCriteria — Immutable Value Object
 *
 * Encapsulates all the data needed to search for duplicates.
 * Used by all consumers: API routes, CSV imports, external sync.
 */

export interface DuplicateCriteriaProps {
  id?: string;
  code?: string;
  externalReference?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  streetType?: string;
  streetName?: string;
  streetNumber?: string;
  postalCode?: string;
  floor?: string;
  locationDetails?: string;
  accessInstructions?: string;
  provisionalNumber?: number;
  establishmentType?: string;
}

export class DuplicateCriteria {
  public readonly id: string | undefined;
  public readonly code: string | undefined;
  public readonly externalReference: string | undefined;
  public readonly name: string | undefined;
  public readonly latitude: number | undefined;
  public readonly longitude: number | undefined;
  public readonly streetType: string | undefined;
  public readonly streetName: string | undefined;
  public readonly streetNumber: string | undefined;
  public readonly postalCode: string | undefined;
  public readonly floor: string | undefined;
  public readonly locationDetails: string | undefined;
  public readonly accessInstructions: string | undefined;
  public readonly provisionalNumber: number | undefined;
  public readonly establishmentType: string | undefined;

  private constructor(props: DuplicateCriteriaProps) {
    this.id = trimOrUndefined(props.id);
    this.code = trimOrUndefined(props.code);
    this.externalReference = trimOrUndefined(props.externalReference);
    this.name = trimOrUndefined(props.name);
    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.streetType = trimOrUndefined(props.streetType);
    this.streetName = trimOrUndefined(props.streetName);
    this.streetNumber = trimOrUndefined(props.streetNumber);
    this.postalCode = trimOrUndefined(props.postalCode);
    this.floor = trimOrUndefined(props.floor);
    this.locationDetails = trimOrUndefined(props.locationDetails);
    this.accessInstructions = trimOrUndefined(props.accessInstructions);
    this.provisionalNumber = props.provisionalNumber;
    this.establishmentType = trimOrUndefined(props.establishmentType);
    Object.freeze(this);
  }

  static create(props: DuplicateCriteriaProps): DuplicateCriteria {
    return new DuplicateCriteria(props);
  }

  /** Has data for identity matching (ID, code, or external reference)? */
  get hasIdentityFields(): boolean {
    return !!(this.id || this.code || this.externalReference);
  }

  /** Has valid finite coordinates for spatial/fuzzy scoring? */
  get hasSpatialFields(): boolean {
    return (
      this.latitude !== undefined &&
      this.longitude !== undefined &&
      Number.isFinite(this.latitude) &&
      Number.isFinite(this.longitude)
    );
  }

  /** Has postal code for fallback search? */
  get hasPostalCode(): boolean {
    return !!this.postalCode;
  }
}

function trimOrUndefined(value: string | undefined | null): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}
