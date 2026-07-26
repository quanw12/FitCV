-- FitCV migration 007 rollback
-- This permanently removes all candidate email drafts and delivery records.

DROP TABLE IF EXISTS candidate_email;
