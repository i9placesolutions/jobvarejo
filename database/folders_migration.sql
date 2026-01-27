-- ===========================================
-- Folder System Migration
-- Run this in your Supabase SQL Editor
-- ===========================================

-- 1. Create folders table with hierarchical structure
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#7c3aed',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add folder_id column to projects table (if not exists)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_projects_folder_id ON public.projects(folder_id);

-- 4. Enable Row Level Security
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for folders
-- Users can view their own folders
CREATE POLICY "Users can view own folders"
  ON public.folders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own folders
CREATE POLICY "Users can insert own folders"
  ON public.folders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
CREATE POLICY "Users can update own folders"
  ON public.folders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete own folders"
  ON public.folders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Update projects RLS policy to include folder_id
-- (This ensures the folder_id is updated when projects are moved)
CREATE POLICY "Users can update own projects folder"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Function to get folder count for a user
CREATE OR REPLACE FUNCTION get_user_folder_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.folders
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
