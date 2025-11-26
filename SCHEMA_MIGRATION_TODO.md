# Schema Migration - Code Updates Required

## Overview
This document tracks all files that need to be updated to use the new AED-centric schema.

## Schema Changes Mapping

### Models
- `DeaRecord` → `Aed`
- `DeaAddressValidation` → `AedAddressValidation`
- `DeaCode` → `AedCodeHistory`
- `VerificationSession` → `ValidationSession` (under `AedValidation`)

### Fields Mapping (DeaRecord → Aed)
```typescript
// Old DeaRecord fields → New Aed + related models
id: number → id: string (UUID)
horaInicio → removed
horaFinalizacion → removed
correoElectronico → responsible.email
nombre → responsible.name
numeroProvisionalDea → provisional_number
tipoEstablecimiento → establishment_type
titularidadLocal → responsible.local_ownership
usoLocal → responsible.local_use
titularidad → responsible.ownership
propuestaDenominacion → name
tipoVia → location.street_type
nombreVia → location.street_name
numeroVia → location.street_number
complementoDireccion → location.additional_info
codigoPostal → location.postal_code
distrito → location.district.name (relation)
latitud → latitude (denormalized) + location.latitude
longitud → longitude (denormalized) + location.longitude
horarioApertura → schedule.description
aperturaLunesViernes → schedule.weekday_opening
cierreLunesViernes → schedule.weekday_closing
aperturaSabados → schedule.saturday_opening
cierreSabados → schedule.saturday_closing
aperturaDomingos → schedule.sunday_opening
cierreDomingos → schedule.sunday_closing
vigilante24h → schedule.has_24h_surveillance
foto1 → images[0].original_url (type: FRONT)
foto2 → images[1].original_url (type: LOCATION)
descripcionAcceso → location.access_description
comentarioLibre → origin_observations
imageVerificationStatus → removed (use validations)
addressValidationStatus → removed (use validations)
createdAt → created_at
updatedAt → updated_at
```

### Address Validation Fields
```typescript
// Old DeaAddressValidation → AedAddressValidation
deaRecordId: number → location_id: string (UUID)
searchResults → suggestions
validationDetails → detected_problems
overallStatus → address_found (boolean) + match_level
recommendedActions → recommended_actions
processedAt → processed_at
processingDurationMs → duration_ms
searchStrategiesUsed → strategies_used
needsReprocessing → removed (recalculate based on processed_at age)
errorMessage → detected_problems (with type: 'error')
retryCount → removed
```

## Files Requiring Updates

### Priority 1: Build-Breaking Files
- [x] `src/app/api/cron/preprocess-validations/route.ts` - UPDATED
- [ ] `src/services/addressValidationPreprocessor.ts`
- [ ] `src/repositories/deaRepository.ts`
- [ ] `src/repositories/verificationRepository.ts`

### Priority 2: Core Services
- [ ] `src/services/deaCodeService.ts`
- [ ] `src/services/deaValidationService.ts`
- [ ] `src/services/stepValidationService.ts`
- [ ] `src/services/deaService.ts`
- [ ] `src/services/simpleVerificationService.ts`
- [ ] `src/services/verificationService.ts`

### Priority 3: API Routes
- [ ] `src/app/api/dea/[id]/validate-steps/route.ts`
- [ ] `src/app/api/dea/[id]/validate/route.ts`
- [ ] `src/app/api/verify/[id]/route.ts`
- [ ] `src/app/api/verify/[id]/select-images/route.ts`
- [ ] `src/app/api/verify/route.ts`
- [ ] `src/app/api/health/route.ts`

### Priority 4: Domain Layer (DDD)
- [ ] `src/dea-management/domain/entities/Dea.ts`
- [ ] `src/dea-management/domain/errors/DeaErrors.ts`
- [ ] `src/dea-management/domain/ports/DeaRepository.ts`
- [ ] `src/dea-management/domain/value-objects/DeaCode.ts`
- [ ] `src/dea-management/infrastructure/prisma/mappers/DeaPrismaMapper.ts`
- [ ] `src/dea-management/infrastructure/prisma/PrismaDeaRepository.ts`

### Priority 5: Frontend/UI
- [ ] `src/hooks/useDeaRecords.ts`
- [ ] `src/types/index.ts`
- [ ] `src/types/verification.ts`
- [ ] `src/utils/helpers.ts`

### Priority 6: Scripts (Non-Critical)
- [ ] `scripts/export-dea-with-validation.ts`
- [ ] `scripts/export-final-dea-images.ts`
- [ ] `scripts/fix-dea-5658-verification.ts`
- [ ] `scripts/import-dea-provisional.ts`
- [ ] `scripts/import-dea-revisadas.ts`
- [ ] `scripts/migrate-sharepoint-to-s3.ts`
- [ ] `scripts/migrate-verification-status.ts`
- [ ] `scripts/preprocess-address-validations.ts`
- [ ] `scripts/update-dea-images.ts`
- [ ] `scripts/verify-s3-migration.ts`
- [ ] `tests/skip-steps-validation.test.ts`

## Quick Fix Strategy

For immediate build success, consider:

1. **Comment out unused routes temporarily**:
   - Old verification routes that aren't critical
   - Legacy scripts

2. **Create facade layer**:
   - Create compatibility wrappers that translate between old and new schemas
   - Gradually update files to use new schema directly

3. **Feature flags**:
   - Keep old code paths active with feature flags
   - Gradually migrate to new schema

## Update Pattern Example

### Before (Old Schema)
```typescript
const record = await prisma.deaRecord.findUnique({
  where: { id: deaId },
  include: { addressValidation: true }
});

const address = `${record.tipoVia} ${record.nombreVia} ${record.numeroVia}`;
```

### After (New Schema)
```typescript
const aed = await prisma.aed.findUnique({
  where: { id: aedId },
  include: {
    location: {
      include: {
        address_validation: true,
        district: true
      }
    }
  }
});

const address = `${aed.location.street_type} ${aed.location.street_name} ${aed.location.street_number}`;
```

## Testing Strategy

After each file update:
1. Run `npx prisma generate`
2. Run `npm run build` to check for TypeScript errors
3. Test the specific functionality if possible
4. Commit incrementally

## Rollback Plan

If issues arise:
1. All changes are in branch `claude/refactor-schemas-015KDJKkN8LwW3bpkNKLqv8B`
2. Can revert specific file changes
3. Database migrations can be rolled back with `prisma migrate`
