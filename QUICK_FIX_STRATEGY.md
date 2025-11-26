# Quick Fix Strategy - Schema Migration

## Current Situation

The new database schema has been implemented, but many files still reference the old `DeaRecord` model. This causes build failures in Vercel.

## Immediate Action Plan

### Option A: Minimal Changes (Recommended for Quick Fix)

1. **Disable non-critical routes temporarily**

Create a `src/app/api/DISABLED/` folder and move these routes:
```bash
# Move verification routes (can be updated later)
mkdir -p src/app/api/DISABLED
mv src/app/api/verify src/app/api/DISABLED/
mv src/app/api/dea/[id]/validate src/app/api/DISABLED/
mv src/app/api/dea/[id]/validate-steps src/app/api/DISABLED/
```

2. **Comment out the cron route temporarily**
Since it's already partially updated, just comment out the export in `src/app/api/cron/preprocess-validations/route.ts`

3. **Update only critical files**:
   - Health check endpoint
   - Any public API endpoints currently in use

### Option B: Complete Migration (Takes Time)

Update all ~22 files to use new schema. See `SCHEMA_MIGRATION_TODO.md` for the complete list.

## Files Already Updated

✅ `src/app/api/cron/preprocess-validations/route.ts` - Partially updated (needs testing)
✅ `prisma/schema.prisma` - New schema implemented
✅ `prisma/seed.ts` - Updated for new schema

## Quick Commands

### To temporarily disable routes:
```bash
# Create disabled folder
mkdir -p src/app/api/DISABLED

# Move non-critical routes
mv src/app/api/verify src/app/api/DISABLED/ 2>/dev/null || true
mv src/app/api/dea/*/validate* src/app/api/DISABLED/ 2>/dev/null || true

# Optionally disable cron too
mv src/app/api/cron src/app/api/DISABLED/ 2>/dev/null || true
```

### To re-enable routes later:
```bash
mv src/app/api/DISABLED/* src/app/api/
rmdir src/app/api/DISABLED
```

## Testing After Fix

1. Run migrations in Vercel preview:
```bash
# In Vercel preview environment
npx prisma migrate deploy
npx prisma db seed
```

2. Verify build:
```bash
npm run build
```

3. Test basic functionality before re-enabling disabled routes

## Long-term Plan

1. ✅ New schema implemented
2. ⏳ Disable old routes (in progress)
3. ⏳ Update core services one by one
4. ⏳ Update domain layer
5. ⏳ Update frontend hooks
6. ⏳ Re-enable and update old routes
7. ⏳ Update scripts
8. ✅ Full system test

## Notes

- The new schema is backward-incompatible by design (better structure)
- Old verification workflows need redesign to fit new schema
- Consider this an opportunity to improve the verification UX
- Some old routes may not be needed anymore

## Recommendation

**For immediate deployment**: Use Option A (disable routes)
**For production-ready**: Complete Option B (full migration)

Current choice: **Start with Option A, then gradually complete Option B**
