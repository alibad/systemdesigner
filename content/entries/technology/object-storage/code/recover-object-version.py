from dataclasses import dataclass


@dataclass(frozen=True)
class Version:
    version_id: str
    checksum: str
    created_at: int
    deleted: bool = False


def select_recovery_version(versions: list[Version], incident_time: int, expected_checksum: str) -> Version:
    candidates = [
        version for version in versions
        if not version.deleted and version.created_at < incident_time and version.checksum == expected_checksum
    ]
    if not candidates:
        raise ValueError("no verified pre-incident version")
    return max(candidates, key=lambda version: version.created_at)


if __name__ == "__main__":
    history = [Version("v1", "sha256:good", 100), Version("v2", "sha256:bad", 200)]
    selected = select_recovery_version(history, incident_time=180, expected_checksum="sha256:good")
    assert selected.version_id == "v1"
    print(selected)
