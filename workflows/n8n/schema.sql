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

-- Existing installations apply this same file with psql before importing workflows.
BEGIN;
ALTER TABLE team_request
    ADD COLUMN IF NOT EXISTS basis_commit text,
    ADD COLUMN IF NOT EXISTS verified_commit text,
    ADD COLUMN IF NOT EXISTS scope_digest text,
    ADD COLUMN IF NOT EXISTS target_repo text,
    ADD COLUMN IF NOT EXISTS evidence_items jsonb,
    ADD COLUMN IF NOT EXISTS draft_fields jsonb;
ALTER TABLE team_request DROP CONSTRAINT IF EXISTS team_request_category_check;
ALTER TABLE team_request ADD CONSTRAINT team_request_category_check
    CHECK (category IN ('이미 지원','현재 미지원','새 기능','확인 필요'));
CREATE TABLE IF NOT EXISTS team_evidence_cache (
    repo text NOT NULL, commit_sha text NOT NULL, scope text NOT NULL,
    snapshot jsonb NOT NULL, last_used timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (repo, commit_sha, scope)
);
COMMIT;

CREATE TABLE IF NOT EXISTS team_model_rate (
    model text PRIMARY KEY, input_usd numeric NOT NULL, output_usd numeric NOT NULL
);
INSERT INTO team_model_rate VALUES
    ('gpt-5.4-mini',0.75,4.50),('gpt-5.4',2.50,15.00),('gpt-4.1-mini',0.40,1.60)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS team_model_month (
    month date PRIMARY KEY, allocated numeric NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS team_model_run (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), turn_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), month date NOT NULL,
    model text NOT NULL, input_rate numeric NOT NULL, output_rate numeric NOT NULL,
    reserved numeric NOT NULL, input_tokens integer, output_tokens integer
);
CREATE INDEX IF NOT EXISTS team_model_turn_idx ON team_model_run(turn_id);
CREATE OR REPLACE FUNCTION team_model_reserve(turn_key text, model_name text, input_bound integer, output_bound integer)
RETURNS TABLE(ticket uuid, warning boolean) LANGUAGE plpgsql AS $$
DECLARE
    m date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
    rate team_model_rate%ROWTYPE;
    amount numeric;
    total numeric;
BEGIN
    SELECT * INTO STRICT rate FROM team_model_rate WHERE model=model_name;
    IF input_bound < 1 OR output_bound < 1 OR length(turn_key) NOT BETWEEN 1 AND 200 THEN
        RAISE EXCEPTION '잘못된 호출 예약';
    END IF;
    amount := (rate.input_usd*input_bound + rate.output_usd*output_bound)/1000000;
    INSERT INTO team_model_month(month) VALUES(m) ON CONFLICT DO NOTHING;
    SELECT allocated INTO total FROM team_model_month WHERE month=m FOR UPDATE;
    IF total+amount > 100 OR (SELECT count(*) FROM team_model_run WHERE turn_id=turn_key)>=3 THEN
        RAISE EXCEPTION '모델 예산 또는 턴 호출 한도 도달';
    END IF;
    DELETE FROM team_model_run WHERE created_at < now()-interval '30 days';
    INSERT INTO team_model_run(turn_id,month,model,input_rate,output_rate,reserved)
      VALUES(turn_key,m,model_name,rate.input_usd,rate.output_usd,amount) RETURNING id INTO ticket;
    UPDATE team_model_month SET allocated=allocated+amount WHERE month=m;
    warning := total+amount >= 80;
    RETURN NEXT;
END $$;
CREATE OR REPLACE FUNCTION team_model_settle(run_id uuid, consumed_input integer, consumed_output integer)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r team_model_run%ROWTYPE;
BEGIN
    IF consumed_input < 0 OR consumed_output < 0 OR consumed_input IS NULL OR consumed_output IS NULL THEN
        RAISE EXCEPTION '사용량 누락';
    END IF;
    UPDATE team_model_run SET input_tokens=consumed_input,output_tokens=consumed_output
      WHERE id=run_id AND input_tokens IS NULL RETURNING * INTO r;
    IF NOT FOUND THEN RETURN false; END IF;
    UPDATE team_model_month SET allocated=allocated-r.reserved+
      (r.input_rate*consumed_input+r.output_rate*consumed_output)/1000000 WHERE month=r.month;
    RETURN true;
END $$;

-- Discord may deliver an event again after reconnecting.
CREATE TABLE IF NOT EXISTS team_discord_event (
    event_id text PRIMARY KEY,
    received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_discord_event_received ON team_discord_event(received_at);
