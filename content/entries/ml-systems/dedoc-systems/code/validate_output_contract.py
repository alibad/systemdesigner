"""Validate the small subset of parsed output required downstream."""

from typing import Any


def validate_contract(payload: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    content = payload.get("content")
    if not isinstance(content, dict):
        return ["content object is missing"]

    structure = content.get("structure")
    if not isinstance(structure, dict) or not structure.get("node_id"):
        problems.append("root structure node is missing")

    metadata = content.get("metadata")
    if not isinstance(metadata, dict) or not metadata.get("file_name"):
        problems.append("source file metadata is missing")

    tables = content.get("tables")
    if not isinstance(tables, list):
        problems.append("tables must be a list, even when empty")

    return problems


if __name__ == "__main__":
    fixture = {
        "content": {
            "structure": {"node_id": "0", "text": "", "subparagraphs": []},
            "metadata": {"file_name": "contract.pdf"},
            "tables": [],
        }
    }
    assert validate_contract(fixture) == []
    print("parsed output satisfies the downstream contract")
