import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/database/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  driver: 'expo', // Uses react-native-sqlite-storage compatible driver
} satisfies Config;
