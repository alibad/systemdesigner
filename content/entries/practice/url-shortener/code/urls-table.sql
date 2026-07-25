CREATE TABLE url_mappings (
  id BIGINT UNSIGNED NOT NULL,
  short_code VARBINARY(12) NOT NULL,
  destination_url VARBINARY(2048) NOT NULL,
  owner_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at TIMESTAMP(6) NULL,
  disabled_at TIMESTAMP(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_url_mappings_short_code (short_code),
  KEY idx_url_mappings_owner_created (owner_id, created_at),
  KEY idx_url_mappings_expiration (expires_at)
) ENGINE = InnoDB;

-- The unique short_code index is the ownership authority.
-- Partitioning or sharding should use a stable hash of short_code.
