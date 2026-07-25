import sqlite3
from pathlib import Path


def open_database(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path, timeout=2.0)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    connection.execute("PRAGMA busy_timeout = 2000")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS tasks (
            task_id TEXT PRIMARY KEY,
            status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'done')),
            updated_at TEXT NOT NULL
        )
        """
    )
    return connection


def mark_running(connection: sqlite3.Connection, task_id: str, updated_at: str) -> bool:
    # Do validation and network work before entering this short write transaction.
    with connection:
        cursor = connection.execute(
            """
            UPDATE tasks
               SET status = 'running', updated_at = ?
             WHERE task_id = ? AND status = 'queued'
            """,
            (updated_at, task_id),
        )
    return cursor.rowcount == 1
