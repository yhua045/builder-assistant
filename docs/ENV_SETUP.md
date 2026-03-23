# Environment Setup & Babel Configuration

## Dynamic Environment File Loading

The Babel configuration (`babel.config.js`) now dynamically selects the appropriate environment file based on the `APP_ENV` environment variable at build time.

### How It Works

```javascript
const appEnv = process.env.APP_ENV || 'development';
const envFilePath = appEnv === 'reset' ? '.env.reset' : `.env.${appEnv}`;
```

**Mapping:**
- `APP_ENV=development` → loads `.env.development`
- `APP_ENV=reset` → loads `.env.reset`
- `APP_ENV=production` → loads `.env.production`
- (no APP_ENV) → defaults to `development` → loads `.env.development`

### Environment Variables Imported via `@env`

All variables from the selected `.env` file are imported as:
```typescript
import { RESET_DEMO_DATA, SEED_DEMO_DATA, ... } from '@env';
```

## Available Environment Files

### `.env.development`
- Development build with real Groq API key
- FORCE_REAL_AUDIO=true (uses real speech-to-text)
- VOICE_USE_MOCK_PARSER=false

### `.env.reset`
- Triggers database reset and re-seeding
- RESET_DEMO_DATA=true (clears all demo_ prefix rows)
- SEED_DEMO_DATA=true (re-populates demo data)

## Using Environment-Specific Commands

```bash
# Development mode (metro bundler + iOS simulator)
npm run start

# Reset and re-seed demo data
npm run seed:reset

# Production mode
npm run ios-15:prod
```

## Migration from Old Setup

**Before:** Babel always loaded `.env` (which didn't exist in repo)
**After:** Babel loads the appropriate `.env.{APP_ENV}` file

This fix ensures that `npm run seed:reset` now properly loads `.env.reset` at Babel compile time, making `RESET_DEMO_DATA=true` available to `App.tsx` during initialization.
