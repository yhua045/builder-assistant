import { Contact } from '../entities/Contact';

export interface ContactRepository {
  save(contact: Contact): Promise<void>;
  findById(id: string): Promise<Contact | null>;
  findAll(): Promise<Contact[]>;
  findByRole(role: string): Promise<Contact[]>;
  findByName(name: string): Promise<Contact[]>;
  update(contact: Contact): Promise<void>;
  delete(id: string): Promise<void>;
}
