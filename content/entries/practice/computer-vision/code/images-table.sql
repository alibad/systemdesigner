CREATE TABLE images (
  id UUID PRIMARY KEY,
  original_filename VARCHAR(255),
  s3_key VARCHAR(500),
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  format VARCHAR(10),
  upload_timestamp TIMESTAMP,
  user_id UUID,
  processing_status VARCHAR(20),
  INDEX idx_upload_time (upload_timestamp),
  INDEX idx_user_status (user_id, processing_status)
);