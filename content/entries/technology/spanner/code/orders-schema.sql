CREATE TABLE Orders (
  OrderId UUID DEFAULT (NEW_UUID()),
  CustomerId STRING(36) NOT NULL,
  CreatedAt TIMESTAMP NOT NULL
    DEFAULT (PENDING_COMMIT_TIMESTAMP())
    OPTIONS (allow_commit_timestamp = true),
  Status STRING(24) NOT NULL
) PRIMARY KEY (OrderId);

CREATE INDEX OrdersByCustomerCreatedAt
ON Orders (CustomerId, CreatedAt DESC)
STORING (Status);
