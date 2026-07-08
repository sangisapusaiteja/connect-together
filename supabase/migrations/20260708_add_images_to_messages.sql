-- Add images column to messages table to store image URLs as JSON array
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS images text;
