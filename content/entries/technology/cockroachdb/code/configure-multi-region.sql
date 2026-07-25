CREATE DATABASE commerce;

ALTER DATABASE commerce SET PRIMARY REGION "us-east1";
ALTER DATABASE commerce ADD REGION "us-west1";
ALTER DATABASE commerce ADD REGION "europe-west1";
ALTER DATABASE commerce SURVIVE REGION FAILURE;

USE commerce;

-- One home region for a write-heavy operational table.
CREATE TABLE merchant_settlements (
    settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    amount_cents INT8 NOT NULL CHECK (amount_cents >= 0),
    status STRING NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY REGIONAL BY TABLE IN "us-east1";

-- Each account row is homed near the region that owns it.
CREATE TABLE customer_accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email STRING NOT NULL,
    balance_cents INT8 NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY REGIONAL BY ROW;

-- Read-mostly reference data is readable locally from every region.
CREATE TABLE tax_rules (
    jurisdiction STRING PRIMARY KEY,
    rate DECIMAL(8, 6) NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL
) LOCALITY GLOBAL;

SHOW REGIONS FROM DATABASE commerce;
SHOW TABLES FROM commerce;
