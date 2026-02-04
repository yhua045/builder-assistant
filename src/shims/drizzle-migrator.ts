type ProxyMigrator = (migrationQueries: string[]) => Promise<void>;

export async function migrate<TSchema>(
  _db: TSchema,
  callback: ProxyMigrator
) {
  // React Native builds cannot use node:fs-based migrator.
  // This no-op migrator keeps the app running for UI/dev previews.
  // Migrations should be applied via drizzle-kit in a Node environment.
  await callback([]);
}
