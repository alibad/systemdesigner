aws neptunedata start-loader-job \
  --endpoint-url "https://${NEPTUNE_ENDPOINT}:8182" \
  --source "s3://${DATA_BUCKET}/graphs/2026-07-24/" \
  --format opencypher \
  --iam-role-arn "${NEPTUNE_LOAD_ROLE_ARN}" \
  --s3-bucket-region "${AWS_REGION}" \
  --parallelism HIGH \
  --no-fail-on-error
