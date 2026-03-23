CREATE TABLE contact_inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

-- 誰でもINSERTできる（公開フォームのため）
CREATE POLICY "Anyone can submit inquiry"
  ON contact_inquiries FOR INSERT
  WITH CHECK (true);

-- super_admin のみ閲覧・更新可能
CREATE POLICY "Only super admins can view inquiries"
  ON contact_inquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Only super admins can update inquiries"
  ON contact_inquiries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
