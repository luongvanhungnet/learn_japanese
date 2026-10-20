CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL CONSTRAINT users_email_key UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT users_name_length CHECK (name = btrim(name) AND char_length(name) BETWEEN 2 AND 80),
  CONSTRAINT users_password_hash_format CHECK (password_hash ~ '^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$')
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sessions_token_hash_format CHECK (token_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE FUNCTION valid_study_values(payload JSONB) RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN jsonb_typeof(payload) <> 'object' THEN FALSE ELSE
    NOT EXISTS (
      SELECT 1 FROM jsonb_each(payload) AS entry
      WHERE entry.key NOT IN (
        'mimikara-progress-v1', 'mimikara-last-practice-v1', 'mimikara-display-modes-v1',
        'mimikara-flashcards-v1', 'mimikara-flashcard-deck-v1', 'mimikara-language', 'mimikara-novel-chapter-v1'
      ) OR jsonb_typeof(entry.value) NOT IN ('string', 'null')
        OR octet_length(entry.value #>> '{}') > 4194304
    ) END;
$$;

CREATE TABLE user_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  study_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_data_valid_values CHECK (valid_study_values(study_values)),
  CONSTRAINT user_data_size_limit CHECK (octet_length(study_values::text) <= 8388608)
);
