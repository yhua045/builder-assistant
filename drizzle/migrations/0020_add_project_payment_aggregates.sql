-- Migration: 0020_add_project_payment_aggregates
-- Adds payment aggregate columns to the projects table for issue #184.
-- Both columns are backward-compatible ADD COLUMN statements (nullable with default 0).

ALTER TABLE "projects" ADD COLUMN "total_payments"   real DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN "pending_payments" real DEFAULT 0;
