import { Contact } from '../../../domain/entities/Contact';
import { Property } from '../../../domain/entities/Property';

const toIsoString = (value?: number | string | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const mapContactFromRow = (row: any, prefix: string): Contact | null => {
  const id = row[`${prefix}id`];
  if (!id) return null;

  const roles = row[`${prefix}roles`];

  return {
    id,
    localId: row[`${prefix}local_id`] ?? undefined,
    name: row[`${prefix}name`] ?? 'Unknown',
    roles: roles ? JSON.parse(roles) : undefined,
    trade: row[`${prefix}trade`] ?? undefined,
    phone: row[`${prefix}phone`] ?? undefined,
    email: row[`${prefix}email`] ?? undefined,
    address: row[`${prefix}address`] ?? undefined,
    rate: row[`${prefix}rate`] ?? undefined,
    notes: row[`${prefix}notes`] ?? undefined,
    createdAt: toIsoString(row[`${prefix}created_at`]),
    updatedAt: toIsoString(row[`${prefix}updated_at`]),
  };
};

export const mapPropertyFromRow = (row: any, prefix: string): Property | null => {
  const id = row[`${prefix}id`];
  if (!id) return null;

  return {
    id,
    localId: row[`${prefix}local_id`] ?? undefined,
    street: row[`${prefix}street`] ?? undefined,
    city: row[`${prefix}city`] ?? undefined,
    state: row[`${prefix}state`] ?? undefined,
    postalCode: row[`${prefix}postal_code`] ?? undefined,
    country: row[`${prefix}country`] ?? undefined,
    address: row[`${prefix}address`] ?? undefined,
    propertyType: row[`${prefix}property_type`] ?? undefined,
    lotSize: row[`${prefix}lot_size`] ?? undefined,
    lotSizeUnit: row[`${prefix}lot_size_unit`] ?? undefined,
    yearBuilt: row[`${prefix}year_built`] ?? undefined,
    ownerId: row[`${prefix}owner_id`] ?? undefined,
    latitude: row[`${prefix}latitude`] ?? null,
    longitude: row[`${prefix}longitude`] ?? null,
    meta: row[`${prefix}meta`] ? JSON.parse(row[`${prefix}meta`]) : undefined,
    createdAt: toIsoString(row[`${prefix}created_at`]),
    updatedAt: toIsoString(row[`${prefix}updated_at`]),
  };
};
