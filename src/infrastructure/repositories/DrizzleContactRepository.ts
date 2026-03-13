import { Contact } from '../../domain/entities/Contact';
import { ContactRepository } from '../../domain/repositories/ContactRepository';
import { initDatabase } from '../database/connection';

export class DrizzleContactRepository implements ContactRepository {
  private async getDb() {
    const { db } = await initDatabase();
    return db;
  }

  private mapRowToEntity(row: any): Contact {
    let roles: Contact['roles'];
    try {
      roles = row.roles ? JSON.parse(row.roles) : undefined;
    } catch {
      roles = undefined;
    }
    return {
      id: row.id,
      localId: row.local_id,
      name: row.name,
      roles,
      trade: row.trade || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      rate: row.rate ?? undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  async save(contact: Contact): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();
    await db.executeSql(
      `INSERT OR REPLACE INTO contacts
        (id, name, roles, trade, phone, email, address, rate, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contact.id,
        contact.name,
        contact.roles ? JSON.stringify(contact.roles) : null,
        contact.trade ?? null,
        contact.phone ?? null,
        contact.email ?? null,
        contact.address ?? null,
        contact.rate ?? null,
        contact.notes ?? null,
        contact.createdAt ? new Date(contact.createdAt).getTime() : now,
        now,
      ],
    );
  }

  async findById(id: string): Promise<Contact | null> {
    const db = await this.getDb();
    const [result] = await db.executeSql(
      'SELECT * FROM contacts WHERE id = ?',
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows.item(0));
  }

  async findAll(): Promise<Contact[]> {
    const db = await this.getDb();
    const [result] = await db.executeSql(
      'SELECT * FROM contacts ORDER BY name ASC',
    );
    const contacts: Contact[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      contacts.push(this.mapRowToEntity(result.rows.item(i)));
    }
    return contacts;
  }

  async findByRole(role: string): Promise<Contact[]> {
    const db = await this.getDb();
    // roles is stored as a JSON array; use LIKE for broad matching
    const [result] = await db.executeSql(
      `SELECT * FROM contacts WHERE roles LIKE ? ORDER BY name ASC`,
      [`%${role}%`],
    );
    const contacts: Contact[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const mapped = this.mapRowToEntity(result.rows.item(i));
      // Double-check the role is actually in the parsed array
      if (!mapped.roles || mapped.roles.includes(role as any)) {
        contacts.push(mapped);
      }
    }
    return contacts;
  }

  async findByName(name: string): Promise<Contact[]> {
    const db = await this.getDb();
    const [result] = await db.executeSql(
      `SELECT * FROM contacts WHERE name LIKE ? ORDER BY name ASC`,
      [`%${name}%`],
    );
    const contacts: Contact[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      contacts.push(this.mapRowToEntity(result.rows.item(i)));
    }
    return contacts;
  }

  async update(contact: Contact): Promise<void> {
    const db = await this.getDb();
    await db.executeSql(
      `UPDATE contacts SET
        name = ?, roles = ?, trade = ?, phone = ?, email = ?,
        address = ?, rate = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        contact.name,
        contact.roles ? JSON.stringify(contact.roles) : null,
        contact.trade ?? null,
        contact.phone ?? null,
        contact.email ?? null,
        contact.address ?? null,
        contact.rate ?? null,
        contact.notes ?? null,
        Date.now(),
        contact.id,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDb();
    await db.executeSql('DELETE FROM contacts WHERE id = ?', [id]);
  }
}
