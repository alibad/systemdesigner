from pathlib import Path
import json


def save_checkpoint(step: int, model_state: dict, optimizer_state: dict) -> Path:
    checkpoint_dir = Path("/opt/ml/checkpoints")
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    temporary = checkpoint_dir / f"step-{step}.json.tmp"
    durable = checkpoint_dir / f"step-{step}.json"
    temporary.write_text(json.dumps({
        "step": step,
        "model": model_state,
        "optimizer": optimizer_state,
    }))
    temporary.replace(durable)
    return durable


def latest_checkpoint() -> Path | None:
    checkpoints = list(Path("/opt/ml/checkpoints").glob("step-*.json"))
    return max(checkpoints, key=lambda path: int(path.stem.split("-")[1]), default=None)
