-- ===========================================
-- Notifications Table Migration
-- Create notifications system for dashboard
-- ===========================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error', 'share', 'project'
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}', -- Additional data like project_id, shared_by, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- 3. Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own notifications (for system notifications)
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Create function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- 7. Create function to create notification when project is shared
CREATE OR REPLACE FUNCTION notify_project_shared()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create notification if project is being shared (is_shared changed from false to true)
    IF NEW.is_shared = true AND (OLD.is_shared IS NULL OR OLD.is_shared = false) THEN
        INSERT INTO public.notifications (user_id, title, message, type, metadata)
        VALUES (
            NEW.user_id,
            'Projeto compartilhado',
            'Seu projeto "' || NEW.name || '" foi compartilhado',
            'share',
            jsonb_build_object('project_id', NEW.id, 'project_name', NEW.name)
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create trigger for project sharing notifications
DROP TRIGGER IF EXISTS trigger_project_shared_notification ON public.projects;
CREATE TRIGGER trigger_project_shared_notification
    AFTER UPDATE OF is_shared ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION notify_project_shared();
