-- ===========================================
-- Update Existing Projects User ID
-- Run this manually if you need to assign user_id to existing projects
-- ===========================================

-- IMPORTANT: Replace 'USER_ID_HERE' with the actual user ID
-- This should be run for each project that needs a user_id assigned

-- Example: Update a specific project
-- UPDATE public.projects
-- SET user_id = 'USER_ID_HERE'
-- WHERE id = 'PROJECT_ID_HERE' AND user_id IS NULL;

-- Or update all projects without user_id to a specific user (use with caution!)
-- UPDATE public.projects
-- SET user_id = 'USER_ID_HERE'
-- WHERE user_id IS NULL;
