"""Run leader work only after acquiring a monotonic fencing token.

The protected resource must persist the highest token it has accepted and reject
commands carrying an older token. ZooKeeper elects one current participant; the
token also protects the resource from a paused former leader that later resumes.
"""

from collections.abc import Callable

from kazoo.client import KazooClient
from kazoo.exceptions import BadVersionError, NodeExistsError, NoNodeError
from kazoo.recipe.election import Election


class FencedLeader:
    def __init__(
        self,
        zk: KazooClient,
        election_path: str,
        identity: str,
        run_work: Callable[[int], None],
    ) -> None:
        self.zk = zk
        self.election_path = election_path
        self.election = Election(zk, election_path, identity)
        self.token_path = f"{election_path}/fencing-token"
        self.run_work = run_work

    def participate(self) -> None:
        """Block until elected, then invoke the callback as the current leader."""
        self.zk.ensure_path(self.election_path)
        self.election.run(self._lead)

    def _lead(self) -> None:
        token = self._next_fencing_token()

        # Every external write must include this token. A database, storage
        # service, or worker should atomically reject token < last_seen_token.
        self.run_work(token)

    def _next_fencing_token(self) -> int:
        """Increment a persistent token with ZooKeeper version-based CAS."""
        while True:
            try:
                raw_value, stat = self.zk.get(self.token_path)
            except NoNodeError:
                try:
                    self.zk.create(self.token_path, b"0")
                except NodeExistsError:
                    # Another elected process or bootstrapper created it first.
                    pass
                continue

            next_token = int(raw_value) + 1
            try:
                self.zk.set(
                    self.token_path,
                    str(next_token).encode(),
                    version=stat.version,
                )
                return next_token
            except BadVersionError:
                # State changed between get and set; reread before retrying.
                continue


def guarded_batch(token: int) -> None:
    print(f"Submitting batch with fencing token {token}")


client = KazooClient(
    hosts="zk-1:2181,zk-2:2181,zk-3:2181",
    timeout=10.0,
)
client.start(timeout=15)

try:
    FencedLeader(
        zk=client,
        election_path="/orders/leader",
        identity="worker-eu-2",
        run_work=guarded_batch,
    ).participate()
finally:
    client.stop()
    client.close()
