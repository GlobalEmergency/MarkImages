#!/usr/bin/env node

/**
 * Conditional Migration Script
 *
 * Runs Prisma migrations only when deploying to Vercel
 * on specific branches (main or refactor branches).
 *
 * This allows:
 * - Local dev: Fast builds without migrations
 * - Vercel preview (other branches): Fast builds without migrations
 * - Vercel (main/refactor): Auto-apply migrations
 */

const { execSync } = require('child_process');

// Check if we're running in Vercel
const isVercel = process.env.VERCEL === '1';

// Get the current git branch
const gitBranch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || '';

// Define branches that should run migrations
const MIGRATION_BRANCHES = ['main', 'refactor'];

// Also allow claude/ branches to run migrations for development previews
const isClaudeBranch = gitBranch.startsWith('claude/');

// Check if current branch matches any migration branch or is a claude branch
const shouldRunMigrations = isVercel && (
  MIGRATION_BRANCHES.some(branch => gitBranch === branch || gitBranch.includes(branch)) ||
  isClaudeBranch
);

console.log('🔍 Migration Check:');
console.log(`   - Running in Vercel: ${isVercel ? '✅' : '❌'}`);
console.log(`   - Current branch: ${gitBranch || 'unknown'}`);
console.log(`   - Should run migrations: ${shouldRunMigrations ? '✅' : '❌'}`);

if (shouldRunMigrations) {
  console.log('\n🚀 Running Prisma migrations...\n');
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: process.env
    });
    console.log('\n✅ Migrations completed successfully\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
} else {
  console.log('\n⏭️  Skipping migrations (not in target branch on Vercel)\n');
}

// Always generate Prisma client
console.log('📦 Generating Prisma client...\n');
try {
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: process.env
  });
  console.log('\n✅ Prisma client generated\n');
} catch (error) {
  console.error('\n❌ Prisma generate failed:', error.message);
  process.exit(1);
}
