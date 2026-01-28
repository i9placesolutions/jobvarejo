-- ===========================================
-- Dashboard Features Migration
-- Add fields for Recently Viewed, Shared Projects, etc.
-- Run this in your Supabase SQL Editor
-- ===========================================

-- 0. Add user_id column if it doesn't exist (required for RLS)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1. Add last_viewed timestamp to track when project was last accessed
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS last_viewed TIMESTAMP WITH TIME ZONE;

-- 2. Add is_shared boolean to mark shared projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

-- 3. Add shared_with array to store user IDs who have access (for future use)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}';

-- 3.5. Add is_starred boolean for starred/favorite projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

-- 4. Ensure updated_at exists and is updated automatically
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 5. Create function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Create index for better query performance on last_viewed
CREATE INDEX IF NOT EXISTS idx_projects_last_viewed ON public.projects(last_viewed DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_is_shared ON public.projects(is_shared);
CREATE INDEX IF NOT EXISTS idx_projects_is_starred ON public.projects(is_starred);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- 8. Update existing projects to set last_viewed = updated_at if last_viewed is null
UPDATE public.projects
SET last_viewed = COALESCE(updated_at, created_at)
WHERE last_viewed IS NULL;
