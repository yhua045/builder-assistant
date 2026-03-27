with open('src/infrastructure/database/migrations.ts', 'r') as f:
    text = f.read()

part1 = text.split("      const [invResult] = await db.executeSql(`SELECT name FROM pragma_table_info('invoices')`);")[0]

part2 = """      const [invResult] = await db.executeSql(`SELECT name FROM pragma_table_info('invoices')`);
      const invExisting = new Set<string>();
      for (let i = 0; i < invResult.rows.length; i++) {
        invExisting.add(invResult.rows.item(i).name);
      }
      if (!invExisting.has('issuer_id')) {
        await db.executeSql(`ALTER TABLE "invoices" ADD COLUMN "issuer_id" text`);
      }
      if (!existing.has('pending_payments_IGNORE')) {
        await db.executeSql(`ALTER TABLE "projects" ADD COLUMN "pending_payments" real DEFAULT 0`);
      }
    },
  },
];

export function getBundledMigrations(): RNMigration[] {
  return migrations;
}
"""

with open('src/infrastructure/database/migrations.ts', 'w') as f:
    f.write(part1 + part2)
