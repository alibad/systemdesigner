"""Dependency-free model of leasing, retry reconciliation, and one-time publish."""

from dataclasses import dataclass, replace
from enum import Enum


class State(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    GENERATED = "generated"
    PUBLISHED = "published"
    REJECTED = "rejected"


@dataclass(frozen=True)
class Job:
    job_id: str
    state: State = State.QUEUED
    attempt: int = 0
    lease_owner: str | None = None
    output_digest: str | None = None


def claim(job: Job, worker_id: str) -> Job:
    if job.state is not State.QUEUED:
        raise ValueError("only queued work can be claimed")
    return replace(job, state=State.RUNNING, attempt=job.attempt + 1, lease_owner=worker_id)


def record_generation(job: Job, worker_id: str, output_digest: str) -> Job:
    if job.state is not State.RUNNING or job.lease_owner != worker_id:
        raise ValueError("worker does not hold the active lease")
    return replace(job, state=State.GENERATED, output_digest=output_digest)


def publish_once(job: Job, safety_passed: bool) -> Job:
    if job.state is not State.GENERATED or not job.output_digest:
        raise ValueError("publication requires a generated, identified output")
    if not safety_passed:
        return replace(job, state=State.REJECTED)
    return replace(job, state=State.PUBLISHED)


if __name__ == "__main__":
    current = claim(Job(job_id="job-42"), worker_id="gpu-7")
    current = record_generation(current, "gpu-7", output_digest="sha256:example")
    current = publish_once(current, safety_passed=True)
    print(current)
