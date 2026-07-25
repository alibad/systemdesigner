"""Bound a live-video queue so overload does not produce stale decisions."""

from collections import deque
from dataclasses import dataclass


@dataclass(frozen=True)
class Frame:
    source_id: str
    sequence: int
    captured_ms: int


class LatestFrameQueue:
    def __init__(self, maximum_frames: int) -> None:
        if maximum_frames < 1:
            raise ValueError("maximum_frames must be positive")
        self._frames: deque[Frame] = deque(maxlen=maximum_frames)
        self.dropped = 0

    def offer(self, frame: Frame) -> None:
        if len(self._frames) == self._frames.maxlen:
            self.dropped += 1
        self._frames.append(frame)

    def take_batch(self, maximum_batch: int) -> list[Frame]:
        batch = [self._frames.popleft() for _ in range(min(maximum_batch, len(self._frames)))]
        return batch


queue = LatestFrameQueue(maximum_frames=3)
for sequence in range(8):
    queue.offer(Frame("dock-7", sequence, captured_ms=sequence * 33))

batch = queue.take_batch(maximum_batch=3)
print("sequences admitted:", [frame.sequence for frame in batch])
print("stale frames dropped:", queue.dropped)

assert [frame.sequence for frame in batch] == [5, 6, 7]
assert queue.dropped == 5
