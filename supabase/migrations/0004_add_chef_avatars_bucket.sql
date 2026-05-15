-- Phase D of Reels + Chef Creator Platform.
-- Storage bucket for chef avatars. Public read so the image URLs work everywhere.

INSERT INTO storage.buckets (id, name, public)
VALUES ('chef-avatars', 'chef-avatars', TRUE)
ON CONFLICT (id) DO NOTHING;
