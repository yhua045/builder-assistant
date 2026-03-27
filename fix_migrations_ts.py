import re

with open('src/infrastructure/database/migrations.ts', 'r') as f:
    content = f.read()

pattern = r"name: '0016_tranquil_sugar_man',\s*sql:.*?\n\s*up: async \(db\) => \{.*?\}(?=\n\s*\},|\n\s*\];)"

new_block = """name: '0016_tranquil_sugar_man',
    sql: `ALTER TABLE \\`invoices\\` ADD \\`issuer_id\\` text;
ALTER TABLE \\`projects\\` ADD \\`total_payments\\` real DEFAULT 0;
ALTER TABLE \\`projects\\` ADD \\`pending_payments\\` real DEFAULT 0;`,
    up: async (db) => {
      // 1) projects
      const [projResult] = await db.executeSql(`SELECT name FROM pragma_table_info('projects')`);
      const projExisting = new Set<string>();
      for (let i = 0; i < projResult.rows.length; i++) {
        projExisting.add(projResult.rows.item(i).name);
      }
      if (!projExisting.has('total_payments')) {
        await db.executeSql(`ALTER TABLE "projects" ADD COLUMN "total_payments" real DEFAULT 0`);
      }
      if (!projExisting.has('pending_payments')) {
        await db.executeSql(`ALTER TABLE "projects" ADD COLUMN "pending_payments" real DEFAULT 0`);
      }

      // 2) invoices
      const [invResult] = await db.executeSql(`SELECT name FROM pragma_table_info('invoices')`);
      const invExisting = new Set<string>();
      for (let i = 0; i < invResult.rows.length; i++) {
        invExisting.add(invResult.rows.item(i).name);
      }
      if (!invExisting.has('issuer_id')) {
        await db.executeSql(`ALTER TABLE "invoices" ADD COLUMN "issuer_id" text`);
      }
    }"""

modified_content = re.sub(pattern, new_block, content, flags=re.DOTALL)

with open('src/infrastructure/database/migrations.ts', 'w') as f:
    f.write(modified_content)
