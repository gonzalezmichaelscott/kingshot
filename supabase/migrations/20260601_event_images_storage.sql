-- Create the event-images storage bucket for inline battle plan images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload event images'
  ) THEN
    CREATE POLICY "Authenticated users can upload event images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'event-images');
  END IF;
END $$;

-- Allow anyone (including anonymous) to read event images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can read event images'
  ) THEN
    CREATE POLICY "Anyone can read event images"
    ON storage.objects FOR SELECT TO anon
    USING (bucket_id = 'event-images');
  END IF;
END $$;

-- Enable realtime for chat_messages table (required for live chat subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
