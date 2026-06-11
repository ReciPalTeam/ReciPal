-- Phase M / WS-A4 — email verification + password reset columns.
-- Tokens are stored as sha256 hashes; raw tokens only ever live in the email link.
-- Existing users are grandfathered as verified (they predate the verification flow).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_token_hash text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_expires timestamp;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_token_hash text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_expires timestamp;

UPDATE public.users SET email_verified = true;
