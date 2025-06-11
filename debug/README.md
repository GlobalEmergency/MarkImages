# Debug Files

This directory contains debug and test files that were used during development but are not needed for production.

## Files

- `debug-chopera-issue.js`: Script for debugging the specific issue with "Paseo De la Chopera 4" that was returning "OPORTO" as a match with 98.8% confidence.
- `debug-chopera-data.js`: Data file used for debugging the Chopera issue.
- `test-de-la-chopera.ts`: Test script for the Chopera validation logic.

These files have been moved here to keep the main codebase clean while preserving them for future reference if similar issues arise.

## Usage

These files are not part of the production application and should not be imported or used in the main codebase. They are preserved for documentation and reference purposes only.

If you need to run any of these scripts for debugging purposes, you can do so directly from this directory:

```bash
# For JavaScript files
node debug-chopera-issue.js

# For TypeScript files
tsx test-de-la-chopera.ts
```
