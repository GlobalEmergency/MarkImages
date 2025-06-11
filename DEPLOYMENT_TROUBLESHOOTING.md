# Deployment Troubleshooting Guide

## Recent Fixes Applied (January 2025)

### Issue: NOT_FOUND Message on Vercel Deployment
**URL**: https://mark-images.vercel.app/deploy

### Root Causes Identified:
1. **Missing Custom 404 Page**: No proper error handling for non-existent routes
2. **Incomplete Framework Configuration**: Next.js not properly detected by Vercel
3. **Missing Route**: `/deploy` route doesn't exist in the application

### Solutions Implemented:

#### 1. Custom 404 Page (`src/app/not-found.tsx`)
- Created a branded 404 page matching the application design
- Added navigation links to main sections (Home, Verification)
- Provides clear user guidance when accessing non-existent routes

#### 2. Enhanced Next.js Configuration (`next.config.ts`)
- Added `output: 'standalone'` for proper Vercel deployment
- Configured image optimization settings
- Added security headers (X-Frame-Options, X-Content-Type-Options)
- Optimized package imports for better performance

#### 3. Improved Vercel Configuration (`vercel.json`)
- Explicitly set `"framework": "nextjs"` for proper detection
- Added API function timeout configuration (30s)
- Configured proper rewrites for API routes
- Added security headers at the edge level
- Set Prisma environment variables for deployment

#### 4. Health Check Endpoint (`/api/health`)
- Created monitoring endpoint to verify deployment status
- Checks database connectivity
- Returns application metrics and version info
- Helps diagnose deployment issues

## Testing the Fixes

### 1. Test the Main Application
- **URL**: https://mark-images.vercel.app/
- **Expected**: DEA Madrid dashboard loads correctly

### 2. Test the 404 Page
- **URL**: https://mark-images.vercel.app/deploy (or any non-existent route)
- **Expected**: Custom 404 page with navigation options

### 3. Test the Health Check
- **URL**: https://mark-images.vercel.app/api/health
- **Expected**: JSON response with application status

### 4. Test Verification Section
- **URL**: https://mark-images.vercel.app/verify
- **Expected**: Verification interface loads correctly

## Common Deployment Issues & Solutions

### Database Connection Issues
**Symptoms**: 500 errors, health check shows "database: disconnected"
**Solutions**:
1. Verify `DATABASE_URL` environment variable is set on Vercel
2. Check database is accessible from Vercel's IP ranges
3. Ensure Prisma migrations are applied in production

### Build Failures
**Symptoms**: Deployment fails during build step
**Solutions**:
1. Check build logs in Vercel dashboard
2. Verify all dependencies are in `package.json`
3. Ensure `npx prisma generate` runs successfully

### API Route Issues
**Symptoms**: API endpoints return 404 or 500 errors
**Solutions**:
1. Check API route file structure matches Next.js App Router conventions
2. Verify environment variables are set
3. Check function timeout settings in `vercel.json`

## Environment Variables Checklist

Ensure these are set in Vercel project settings:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Authentication secret (if using auth)
- `NODE_ENV`: Should be "production"

## Monitoring & Debugging

### Health Check Endpoint
Use `/api/health` to monitor:
- Application status
- Database connectivity
- Record counts
- Environment information

### Vercel Analytics
- Monitor page load times
- Track user interactions
- Identify performance bottlenecks

### Error Tracking
- Check Vercel function logs
- Monitor database query performance
- Track API response times

## Deployment Best Practices

1. **Always test locally first**: Run `npm run build` locally before deploying
2. **Use staging environment**: Test changes on a staging deployment
3. **Monitor after deployment**: Check health endpoint and key functionality
4. **Keep dependencies updated**: Regular updates prevent compatibility issues
5. **Use proper error handling**: Implement try-catch blocks in API routes

## Contact & Support

If issues persist:
1. Check Vercel deployment logs
2. Test the health check endpoint
3. Verify environment variables
4. Review this troubleshooting guide
5. Contact the development team with specific error messages

## Version History

- **v1.0** (January 2025): Initial deployment fixes
  - Added custom 404 page
  - Enhanced Next.js and Vercel configuration
  - Created health check endpoint
  - Improved error handling
