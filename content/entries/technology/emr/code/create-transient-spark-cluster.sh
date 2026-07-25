#!/usr/bin/env bash
set -euo pipefail

: "${EMR_SERVICE_ROLE:?Set the EMR service role name}"
: "${EMR_EC2_INSTANCE_PROFILE:?Set the EC2 instance profile name}"
: "${EMR_SUBNET_ID:?Set a private subnet ID}"
: "${EMR_LOG_URI:?Set an encrypted S3 log URI}"
: "${SPARK_SCRIPT_URI:?Set the versioned S3 URI of the PySpark program}"

RELEASE_LABEL="${RELEASE_LABEL:-emr-7.13.0}"

aws emr create-cluster \
  --name "transient-daily-sales-etl" \
  --release-label "${RELEASE_LABEL}" \
  --applications Name=Spark \
  --service-role "${EMR_SERVICE_ROLE}" \
  --ec2-attributes "InstanceProfile=${EMR_EC2_INSTANCE_PROFILE},SubnetId=${EMR_SUBNET_ID}" \
  --instance-fleets file://instance-fleets.json \
  --steps "Type=Spark,Name=DailySalesETL,ActionOnFailure=TERMINATE_CLUSTER,Args=[--deploy-mode,cluster,${SPARK_SCRIPT_URI}]" \
  --log-uri "${EMR_LOG_URI}" \
  --auto-termination-policy IdleTimeout=900 \
  --tags owner=data-platform workload=daily-sales environment=production
