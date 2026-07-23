-- FitCV migration 006 rollback
-- This permanently removes recruiter pipeline notes and stage history.

DROP TABLE IF EXISTS application_note;
DROP TABLE IF EXISTS application_stage_history;
