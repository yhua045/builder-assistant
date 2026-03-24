import { Contact } from '../entities/Contact';

export interface ContactRepository {
  save(contact: Contact): Promise<void>;
  findById(id: string): Promise<Contact | null>;
  findAll(): Promise<Contact[]>;
  findByRole(role: string): Promise<Contact[]>;
  findByName(name: string): Promise<Contact[]>;
  update(contact: Contact): Promise<void>;
  delete(id: string): Promise<void>;
  /** Atomically increment usageCount for the given contact id (issue #171) */
  incrementUsageCount(id: string): Promise<void>;
  /** Return contacts ordered by usageCount DESC, falling back to name ASC (issue #171) */
  findMostUsed(limit?: number): Promise<Contact[]>;
}
