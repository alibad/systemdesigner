"""Dependency-free browser policy model for CSP, CORS, framing, and CSRF."""

from dataclasses import dataclass


@dataclass(frozen=True)
class BrowserPolicy:
    allowed_cors_origins: frozenset[str]
    allow_credentials: bool
    allow_inline_script: bool
    frame_ancestors: str
    same_site: str
    require_csrf_token: bool


def cors_allows(policy: BrowserPolicy, origin: str, credentialed: bool) -> bool:
    if origin not in policy.allowed_cors_origins:
        return False
    return not credentialed or policy.allow_credentials


def inline_script_runs(policy: BrowserPolicy, has_nonce: bool) -> bool:
    return policy.allow_inline_script or has_nonce


def frame_allows(policy: BrowserPolicy, ancestor: str, app_origin: str) -> bool:
    if policy.frame_ancestors == "none":
        return False
    if policy.frame_ancestors == "self":
        return ancestor == app_origin
    return True


def cross_site_post_changes_state(policy: BrowserPolicy, valid_token: bool) -> bool:
    cookie_sent = policy.same_site == "None"
    token_passes = valid_token if policy.require_csrf_token else True
    return cookie_sent and token_passes


baseline = BrowserPolicy(
    allowed_cors_origins=frozenset({"https://partner.example"}),
    allow_credentials=True,
    allow_inline_script=False,
    frame_ancestors="self",
    same_site="Lax",
    require_csrf_token=True,
)

assert cors_allows(baseline, "https://partner.example", credentialed=True)
assert not cors_allows(baseline, "https://evil.example", credentialed=True)
assert not inline_script_runs(baseline, has_nonce=False)
assert not frame_allows(baseline, "https://evil.example", "https://app.example")
assert not cross_site_post_changes_state(baseline, valid_token=False)

print("partner API: allowed")
print("attacker API: blocked")
print("inline script: blocked")
print("hostile frame: blocked")
print("cross-site POST: blocked")
