CREATE TABLE IF NOT EXISTS team_request (
    request_id text PRIMARY KEY,
    request_text text NOT NULL,
    spec_sha text NOT NULL,
    category text NOT NULL CHECK (category IN ('이미 지원', '새 기능', '확인 필요')),
    evidence text NOT NULL,
    answer text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    state text NOT NULL CHECK (state IN ('answered', 'pending', 'rejected', 'publishing', 'published')),
    revision integer NOT NULL DEFAULT 1,
    review_token uuid NOT NULL DEFAULT gen_random_uuid(),
    issue_number bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    CHECK ((category = '새 기능') = (state <> 'answered')),
    CHECK ((state = 'published') = (issue_number IS NOT NULL))
);
