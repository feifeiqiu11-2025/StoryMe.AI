-- Fix Storage RLS Policies for story-audio-files bucket
-- This allows authenticated users to upload and access audio files

-- First, make sure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-audio-files', 'story-audio-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload audio files
CREATE POLICY "Authenticated users can upload audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'story-audio-files'
);

-- Allow authenticated users to update their audio files
CREATE POLICY "Authenticated users can update audio files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'story-audio-files'
);

-- Allow public read access to audio files (so they can be played in browser)
CREATE POLICY "Public can read audio files"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'story-audio-files'
);

-- Allow authenticated users to delete their audio files
CREATE POLICY "Authenticated users can delete audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'story-audio-files'
);
