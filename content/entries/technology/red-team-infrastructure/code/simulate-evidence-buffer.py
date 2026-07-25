#!/usr/bin/env python3
"""Estimate evidence buffering during a degraded collection path."""

import argparse
import math


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--incoming-eps", type=float, default=90)
    parser.add_argument("--healthy-capacity-eps", type=float, default=60)
    parser.add_argument("--outage-minutes", type=float, default=12)
    parser.add_argument("--buffer-minutes", type=float, default=6)
    args = parser.parse_args()

    if min(vars(args).values()) < 0:
        parser.error("rates and durations cannot be negative")

    outage_seconds = args.outage_minutes * 60
    overflow_eps = max(0, args.incoming_eps - args.healthy_capacity_eps)
    events_needing_buffer = math.ceil(overflow_eps * outage_seconds)
    buffer_capacity = math.floor(args.incoming_eps * args.buffer_minutes * 60)
    buffered = min(events_needing_buffer, buffer_capacity)
    dropped = events_needing_buffer - buffered

    print(f"events needing buffer: {events_needing_buffer:,}")
    print(f"events buffered:       {buffered:,}")
    print(f"evidence gap:          {dropped:,}")
    print("decision: " + ("pause before the buffer fills" if dropped else "degraded path is covered"))


if __name__ == "__main__":
    main()
