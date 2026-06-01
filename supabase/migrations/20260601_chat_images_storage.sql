-- Create the chat-images storage bucket for inline chat image uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload chat images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload chat images'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'chat-images');
  END IF;
END $$;

-- Allow anyone (including anonymous) to read chat images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can read chat images'
  ) THEN
    CREATE POLICY "Anyone can read chat images"
    ON storage.objects FOR SELECT TO anon
    USING (bucket_id = 'chat-images');
  END IF;
END $$;
