-- Organisation admins sign in with just their work email, so organisations are looked up by domain.
CREATE INDEX IF NOT EXISTS organizations_email_domain_idx ON platform.organizations (email_domain);
