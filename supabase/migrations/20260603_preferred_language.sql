-- Per-player preferred language for chat/board/event auto-translation.
-- Stored on both the member row (self-service / leader edits) and the linked
-- user_profile (logged-in account), kept in sync by /api/member/language.

ALTER TABLE members ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';
