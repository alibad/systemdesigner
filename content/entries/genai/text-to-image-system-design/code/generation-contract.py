"""Validate and fingerprint one bounded text-to-image generation request."""

from dataclasses import asdict, dataclass
from hashlib import sha256
import json


ALLOWED_SIZES = {(512, 512), (768, 768), (1024, 1024)}
ALLOWED_TIERS = {"preview", "balanced", "quality"}


@dataclass(frozen=True)
class GenerationContract:
    tenant_id: str
    request_id: str
    prompt: str
    width: int
    height: int
    image_count: int
    quality_tier: str
    model_recipe: str
    policy_version: str
    seed: int | None = None

    def validate(self) -> None:
        prompt = self.prompt.strip()
        if not prompt or len(prompt) > 2_000:
            raise ValueError("prompt must contain 1 to 2,000 characters")
        if (self.width, self.height) not in ALLOWED_SIZES:
            raise ValueError("dimensions are not supported by this worker pool")
        if not 1 <= self.image_count <= 4:
            raise ValueError("image_count must be between 1 and 4")
        if self.quality_tier not in ALLOWED_TIERS:
            raise ValueError("unknown quality tier")
        if not self.model_recipe or not self.policy_version:
            raise ValueError("model_recipe and policy_version are required")

    def idempotency_fingerprint(self) -> str:
        """Hash normalized intent without exposing the prompt in a queue key."""
        self.validate()
        normalized = asdict(self)
        normalized["prompt"] = " ".join(self.prompt.split())
        payload = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
        return sha256(payload.encode("utf-8")).hexdigest()


if __name__ == "__main__":
    contract = GenerationContract(
        tenant_id="studio-42",
        request_id="req-1842",
        prompt="A cutaway diagram of a solar-powered research station",
        width=768,
        height=768,
        image_count=2,
        quality_tier="balanced",
        model_recipe="image-model-2026-07@sha256:8f4d",
        policy_version="public-creative-v12",
        seed=983_114,
    )
    print(contract.idempotency_fingerprint())
