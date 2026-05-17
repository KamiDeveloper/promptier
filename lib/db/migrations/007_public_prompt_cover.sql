-- Migration 007: public prompt cover image
-- Adds the selected optimized image data URL used by Prompterest feed cards.

ALTER TABLE public_prompts
  ADD COLUMN IF NOT EXISTS optimized_image_url TEXT;
