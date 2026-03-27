import re

with open('src/infrastructure/database/migrations.ts', 'r') as f:
    content = f.read()

# Replace the 0025 block
pattern = r"tag: '0025_project_payment_aggregates'.*"

new_block = """tag: '0025_project_payment_aggregates',
    hash: '0025_project_payment_aggregates',
    folderMillis: 1774569600000,
    sql: [],
    run: async (db) => {
      const [result] = await db.executeSql(`SELECT name FROM pragma_table_info('projects')`);
      const existing = new Set<string>();
      for (let i = 0; i < result.rows.length; i++) {
        existing.add(result.rows.item(i).name);
      }
      if (!existing.has('total_payments')) {
        await db.executeSql(`ALTER TABLE "projects" ADD COLUMN "total_payments" real DEFAULT 0`);
      }
      if (!existing.has('pending_payments')) {
        await db.executeSql(`ALTER TABLE "projects" ADD COLUMN "pending_payments" real DEFAULT 0`);
      }

      const [invResult] = await db.executeSql(`SELECT name FROM pragma_table_info('invoices')`);
      const invExisting = new Set<string>();
      for (let i = 0; i < invResult.rows.length; i++) {
        invExisting.add(invResult.rows.item(i).name);
      }
      if (!invExisting.has('issuer_id')) {
        await db.executeSql(`ALTER TABLE "invoices" ADD COLUMN "issuer_id" text`);
      }
    },
  },
];

export function getBundledMigrations(): RNMigration[] {
  return migrations;
}"""

modified_content = re.sub(pattern, new_block, content, flags=re.DOTALL)

with open('src/infrastructure/database/migrations.ts', 'w') as f:
    f.write(modified_content)
