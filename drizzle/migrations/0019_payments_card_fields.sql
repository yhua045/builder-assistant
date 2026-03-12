-- Migration: 0011_payments_card_fields
-- Adds display/grouping columns to the payments table for issue #142.
-- All four are backward-compatible ADD COLUMN statements (nullable or defaulted).

ALTER TABLE "payments" ADD COLUMN "contact_id"        text;
ALTER TABLE "payments" ADD COLUMN "contractor_name"   text;
ALTER TABLE "payments" ADD COLUMN "payment_category"  text NOT NULL DEFAULT 'other';
ALTER TABLE "payments" ADD COLUMN "stage_label"       text;
