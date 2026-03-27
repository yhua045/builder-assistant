with open('src/infrastructure/database/migrations.ts', 'r') as f:
    text = f.read()

text = text.replace("if (!existing.has('pending_payments')) {", """    if (!existing.has('pending_payments')) {
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
      
      if (!existing.has('pending_payments_IGNORE')) {""")

with open('src/infrastructure/database/migrations.ts', 'w') as f:
    f.write(text)
