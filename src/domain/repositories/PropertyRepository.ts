import { Property } from '../entities/Property';

export interface PropertyRepository {
  save(property: Property): Promise<void>;
  findById(id: string): Promise<Property | null>;
  findAll(): Promise<Property[]>;
  findByAddress(address: string): Promise<Property | null>;
  findByOwnerId(ownerId: string): Promise<Property[]>;
  update(property: Property): Promise<void>;
  delete(id: string): Promise<void>;
}
