-- Add admin flag to profiles
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;

-- Create admin audit log table
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system metrics table
CREATE TABLE system_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create overview statistics view
CREATE VIEW admin_overview_stats AS
SELECT
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(*) FROM rosters WHERE updated_at > NOW() - INTERVAL '30 days') as active_rosters,
  (SELECT 
    COUNT(*) FILTER (WHERE subscription_tier = 'PRO') * 7900 +
    COUNT(*) FILTER (WHERE subscription_tier = 'STUDIO') * 14900 +
    COUNT(*) FILTER (WHERE subscription_tier = 'NETWORK') * 24900
   FROM profiles WHERE subscription_tier != 'BASIC') as monthly_revenue_cents,
  (SELECT COALESCE(SUM(credits_used), 0) FROM user_usage WHERE created_at > DATE_TRUNC('month', NOW())) as credits_this_month;

-- Create daily signups view
CREATE VIEW daily_signups AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as signup_count
FROM profiles
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC
LIMIT 30;

-- Enable RLS on new tables
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admins can view audit logs"
  ON admin_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can view system metrics"
  ON system_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));