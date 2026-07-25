#!/usr/bin/env bash
set -eu

: "${OOZIE_URL:?Set OOZIE_URL}"
: "${JOB_ID:?Set JOB_ID}"

# Capture immutable evidence before changing job state.
oozie job -oozie "$OOZIE_URL" -info "$JOB_ID"
oozie job -oozie "$OOZIE_URL" -log "$JOB_ID"
oozie job -oozie "$OOZIE_URL" -definition "$JOB_ID"

# Validate the patched application, then choose one reviewed rerun boundary.
oozie validate -oozie "$OOZIE_URL" hdfs:///apps/orders/workflow.xml

# Workflow example:
# oozie job -oozie "$OOZIE_URL" -rerun "$JOB_ID" \
#   -Doozie.wf.rerun.failnodes=true

# Coordinator example; -nocleanup preserves output-event directories.
# oozie job -oozie "$OOZIE_URL" -rerun "$JOB_ID" \
#   -action 42 -refresh -nocleanup
