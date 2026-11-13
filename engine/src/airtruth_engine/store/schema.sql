-- Event log schema with tenant row-level isolation.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'airtruth_app') THEN
        CREATE ROLE airtruth_app NOLOGIN;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS tenant (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    regime      text NOT NULL CHECK (regime IN ('dgca', 'us_dot', 'eu261')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event (
    seq             bigserial PRIMARY KEY,
    tenant_id       text NOT NULL REFERENCES tenant (id),
    event_id        text NOT NULL,
    flight_ref      text NOT NULL,
    tail_number     text,
    type            text NOT NULL,
    status          text,
    substatus       text,
    occurred_at     timestamptz NOT NULL,
    received_at     timestamptz NOT NULL DEFAULT now(),
    asserted_by     text NOT NULL,
    source_adapter  text NOT NULL,
    body            jsonb NOT NULL,
    payload_hash    text NOT NULL,
    UNIQUE (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS event_flight_timeline
    ON event (tenant_id, flight_ref, occurred_at, received_at, seq);

CREATE OR REPLACE FUNCTION event_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'event log is append-only';
END
$$;

DROP TRIGGER IF EXISTS event_append_only ON event;
CREATE TRIGGER event_append_only
    BEFORE UPDATE OR DELETE ON event
    FOR EACH ROW EXECUTE FUNCTION event_forbid_mutation();

DROP TRIGGER IF EXISTS event_no_truncate ON event;
CREATE TRIGGER event_no_truncate
    BEFORE TRUNCATE ON event
    FOR EACH STATEMENT EXECUTE FUNCTION event_forbid_mutation();

ALTER TABLE event ENABLE ROW LEVEL SECURITY;
ALTER TABLE event FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_tenant_isolation ON event;
CREATE POLICY event_tenant_isolation ON event
    USING (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT ON tenant TO airtruth_app;
GRANT SELECT, INSERT ON event TO airtruth_app;
GRANT USAGE ON SEQUENCE event_seq_seq TO airtruth_app;

