-- PostgreSQL model for payment workflow state and immutable accounting journals.
CREATE TABLE payment_intents (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency CHAR(3) NOT NULL,
    capture_method TEXT NOT NULL CHECK (capture_method IN ('automatic', 'manual')),
    status TEXT NOT NULL CHECK (status IN (
        'requires_payment_method',
        'requires_confirmation',
        'processing',
        'authorized',
        'succeeded',
        'failed',
        'canceled'
    )),
    version BIGINT NOT NULL DEFAULT 0,
    captured_minor BIGINT NOT NULL DEFAULT 0 CHECK (captured_minor >= 0),
    refunded_minor BIGINT NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (refunded_minor <= captured_minor)
);

CREATE TABLE payment_attempts (
    id UUID PRIMARY KEY,
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id),
    operation TEXT NOT NULL CHECK (operation IN ('authorize', 'capture', 'cancel', 'refund')),
    provider TEXT NOT NULL,
    provider_request_ref TEXT NOT NULL,
    provider_transaction_id TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('created', 'processing', 'approved', 'declined', 'unknown')),
    request_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_request_ref)
);

CREATE TABLE idempotency_records (
    merchant_id UUID NOT NULL,
    operation TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id),
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (merchant_id, operation, idempotency_key)
);

CREATE TABLE refunds (
    id UUID PRIMARY KEY,
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id),
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    status TEXT NOT NULL CHECK (status IN ('processing', 'succeeded', 'failed')),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ledger_journals (
    id UUID PRIMARY KEY,
    legal_entity_id UUID NOT NULL,
    source_operation_id UUID NOT NULL UNIQUE,
    journal_type TEXT NOT NULL CHECK (journal_type IN ('capture', 'refund', 'fee', 'adjustment')),
    currency CHAR(3) NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY,
    journal_id UUID NOT NULL REFERENCES ledger_journals(id),
    account_id UUID NOT NULL,
    signed_amount_minor BIGINT NOT NULL CHECK (signed_amount_minor <> 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ledger_entries_account_time
    ON ledger_entries (account_id, created_at, id);

CREATE OR REPLACE FUNCTION assert_entries_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    line_count INTEGER;
    journal_total NUMERIC;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(signed_amount_minor), 0)
      INTO line_count, journal_total
      FROM ledger_entries
     WHERE journal_id = NEW.journal_id;

    IF line_count < 2 OR journal_total <> 0 THEN
        RAISE EXCEPTION 'ledger journal % is not balanced', NEW.journal_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ledger_entries_balance_at_commit
AFTER INSERT OR UPDATE ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_entries_balance();

CREATE TABLE payment_outbox (
    id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    aggregate_version BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (aggregate_id, aggregate_version, event_type)
);

CREATE TABLE provider_event_inbox (
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    payload_sha256 TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    PRIMARY KEY (provider, provider_event_id)
);

-- Application writes commit the intent version, ledger journal, and outbox event in
-- one transaction. Runtime roles receive INSERT and SELECT on ledger tables, but not
-- UPDATE or DELETE; corrections are new reversing journals.
