-- =====================================================
--  DOS RAYOS — Schema de base de datos
--  Pegar en Supabase > SQL Editor > Run
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_metrics (
  id              SERIAL PRIMARY KEY,
  platform        VARCHAR(50) NOT NULL,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  followers       BIGINT,
  following       INTEGER,
  posts_count     INTEGER,
  avg_likes       NUMERIC(12,2),
  avg_comments    NUMERIC(12,2),
  avg_views       NUMERIC(12,2),
  reach_7d        BIGINT,
  impressions_7d  BIGINT,
  engagement_rate NUMERIC(6,4),
  raw_data        JSONB
);

CREATE TABLE IF NOT EXISTS posts (
  id            SERIAL PRIMARY KEY,
  platform      VARCHAR(50) NOT NULL,
  post_id       VARCHAR(255) UNIQUE,
  post_type     VARCHAR(50),
  title         TEXT,
  description   TEXT,
  published_at  TIMESTAMPTZ,
  likes         BIGINT DEFAULT 0,
  comments      BIGINT DEFAULT 0,
  shares        BIGINT DEFAULT 0,
  views         BIGINT DEFAULT 0,
  saves         BIGINT DEFAULT 0,
  reach         BIGINT DEFAULT 0,
  thumbnail_url TEXT,
  post_url      TEXT,
  raw_data      JSONB
);

CREATE TABLE IF NOT EXISTS recent_comments (
  id            SERIAL PRIMARY KEY,
  platform      VARCHAR(50) NOT NULL,
  post_id       VARCHAR(255),
  comment_id    VARCHAR(255) UNIQUE,
  username      VARCHAR(255),
  comment_text  TEXT,
  likes         INTEGER DEFAULT 0,
  sentiment     VARCHAR(20),
  published_at  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_analysis (
  id            SERIAL PRIMARY KEY,
  analysis_type VARCHAR(100) NOT NULL,
  platform      VARCHAR(50),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  result        JSONB NOT NULL,
  tokens_used   INTEGER
);

CREATE TABLE IF NOT EXISTS content_ideas (
  id            SERIAL PRIMARY KEY,
  platform      VARCHAR(50) NOT NULL,
  topic         TEXT NOT NULL,
  format        VARCHAR(50),
  hook          TEXT,
  description   TEXT,
  hashtags      TEXT[],
  trend_score   NUMERIC(4,2),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  used          BOOLEAN DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS content_calendar (
  id              SERIAL PRIMARY KEY,
  platform        VARCHAR(50) NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  content_idea_id INTEGER REFERENCES content_ideas(id),
  title           TEXT,
  status          VARCHAR(30) DEFAULT 'planned',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_platform  ON platform_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_metrics_fetched   ON platform_metrics(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_platform    ON posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_published   ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_platform ON recent_comments(platform);
CREATE INDEX IF NOT EXISTS idx_comments_date     ON recent_comments(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_type     ON ai_analysis(analysis_type);
