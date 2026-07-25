"""Rebuild service membership and cached state after ZooKeeper events."""

from dataclasses import dataclass
from threading import Lock

from kazoo.client import KazooClient, KazooState
from kazoo.exceptions import NodeExistsError


@dataclass(frozen=True)
class ConfigSnapshot:
    value: bytes
    version: int


class CoordinatedService:
    def __init__(self, zk: KazooClient, instance_id: str) -> None:
        self.zk = zk
        self.instance_path = f"/services/payments/{instance_id}"
        self.config_path = "/config/payments"
        self._lock = Lock()
        self._serving = False
        self._session_was_lost = False
        self._config: ConfigSnapshot | None = None

        zk.add_listener(self._on_connection_state)

    def start(self) -> None:
        self.zk.ensure_path("/services/payments")
        self._register_ephemeral()
        self._read_and_watch_config()
        self._set_serving(True)

    def _on_connection_state(self, state: KazooState) -> None:
        if state in (KazooState.SUSPENDED, KazooState.LOST):
            # Stop work that depends on current membership or ownership.
            self._set_serving(False)

        if state == KazooState.LOST:
            # The old session and all of its ephemeral state are gone.
            self._session_was_lost = True

        if state == KazooState.CONNECTED:
            if self._session_was_lost:
                self._register_ephemeral()
                self._session_was_lost = False

            # A watch is an invalidation signal, not a complete event history.
            # Rebuild the cache from the authoritative value after reconnect.
            self._read_and_watch_config()
            self._set_serving(True)

    def _register_ephemeral(self) -> None:
        payload = b"https://payments-17.internal:8443"
        try:
            self.zk.create(self.instance_path, payload, ephemeral=True)
        except NodeExistsError:
            # Reconcile ownership before replacing an existing registration.
            stat = self.zk.exists(self.instance_path)
            if stat is None:
                self.zk.create(self.instance_path, payload, ephemeral=True)
                return
            owner = stat.ephemeralOwner
            if owner != self.zk.client_id[0]:
                raise RuntimeError("registration belongs to another session")

    def _read_and_watch_config(self) -> None:
        def invalidate(_event: object) -> None:
            self._read_and_watch_config()

        value, stat = self.zk.get(self.config_path, watch=invalidate)
        with self._lock:
            self._config = ConfigSnapshot(value=value, version=stat.version)

    def _set_serving(self, serving: bool) -> None:
        with self._lock:
            self._serving = serving


client = KazooClient(
    hosts="zk-1:2181,zk-2:2181,zk-3:2181",
    timeout=10.0,
)
client.start(timeout=15)

service = CoordinatedService(client, instance_id="payments-17")
service.start()
