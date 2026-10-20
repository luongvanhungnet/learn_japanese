-- Extend the existing account data whitelist without replacing stored progress.
CREATE OR REPLACE FUNCTION valid_study_values(payload JSONB) RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN jsonb_typeof(payload) <> 'object' THEN FALSE ELSE
    NOT EXISTS (
      SELECT 1 FROM jsonb_each(payload) AS entry
      WHERE entry.key NOT IN (
        'mimikara-progress-v1', 'mimikara-last-practice-v1', 'mimikara-display-modes-v1',
        'mimikara-flashcards-v1', 'mimikara-flashcard-deck-v1', 'mimikara-language',
        'mimikara-novel-chapter-v1', 'mimikara-exams-v1'
      ) OR jsonb_typeof(entry.value) NOT IN ('string', 'null')
        OR octet_length(entry.value #>> '{}') > 4194304
    ) END;
$$;
