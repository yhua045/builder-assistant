-- Migration 0004: Invoice module review - no-op
--
-- This migration is intentionally empty. After reviewing the domain
-- entities and the existing Drizzle schema, no schema changes were
-- necessary: `invoices` and `payments` tables already contain the
-- required columns (`currency`, `notes`, timestamps, external keys,
-- JSON fields, and indexes). The application code normalizes empty
-- external keys to NULL to avoid uniqueness conflicts.

-- Generated: 2026-02-12
