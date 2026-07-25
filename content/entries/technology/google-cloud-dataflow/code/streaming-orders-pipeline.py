"""Apache Beam event-time pipeline intended for the Dataflow runner.

Run without flags to exercise the dependency-free parser. Pass --run with the
required Beam/Dataflow pipeline options to construct and execute the cloud job.
"""

import argparse
import json
from datetime import datetime, timezone
from typing import Any


def parse_order(payload: bytes) -> dict[str, Any]:
    record = json.loads(payload.decode("utf-8"))
    required = {"event_id", "event_time", "customer_id", "amount"}
    missing = required.difference(record)
    if missing:
        raise ValueError(f"missing fields: {sorted(missing)}")

    event_time = datetime.fromisoformat(record["event_time"].replace("Z", "+00:00"))
    if event_time.tzinfo is None:
        raise ValueError("event_time must include a timezone")
    if float(record["amount"]) < 0:
        raise ValueError("amount must be non-negative")

    return {
        "event_id": str(record["event_id"]),
        "event_timestamp": event_time.astimezone(timezone.utc).timestamp(),
        "customer_id": str(record["customer_id"]),
        "amount": float(record["amount"]),
    }


def run(argv: list[str]) -> None:
    import apache_beam as beam
    from apache_beam.options.pipeline_options import PipelineOptions
    from apache_beam.transforms import trigger, window

    parser = argparse.ArgumentParser()
    parser.add_argument("--input_subscription", required=True)
    parser.add_argument("--output_table", required=True)
    parser.add_argument("--dead_letter_path", required=True)
    known, pipeline_args = parser.parse_known_args(argv)

    class ParseWithDeadLetter(beam.DoFn):
        DEAD_LETTER = "dead-letter"

        def process(self, payload: bytes):
            try:
                record = parse_order(payload)
                yield beam.window.TimestampedValue(
                    record,
                    record.pop("event_timestamp"),
                )
            except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError) as error:
                yield beam.pvalue.TaggedOutput(
                    self.DEAD_LETTER,
                    json.dumps({"payload": payload.decode("utf-8", errors="replace"), "error": str(error)}),
                )

    options = PipelineOptions(pipeline_args, streaming=True, save_main_session=True)
    with beam.Pipeline(options=options) as pipeline:
        parsed = (
            pipeline
            | "Read Pub/Sub" >> beam.io.ReadFromPubSub(subscription=known.input_subscription)
            | "Parse and validate" >> beam.ParDo(ParseWithDeadLetter()).with_outputs(
                ParseWithDeadLetter.DEAD_LETTER,
                main="valid",
            )
        )

        totals = (
            parsed.valid
            | "Key by customer" >> beam.Map(lambda row: (row["customer_id"], row["amount"]))
            | "Window by event time" >> beam.WindowInto(
                window.FixedWindows(60),
                trigger=trigger.AfterWatermark(
                    early=trigger.AfterProcessingTime(30),
                    late=trigger.AfterCount(1),
                ),
                accumulation_mode=trigger.AccumulationMode.ACCUMULATING,
                allowed_lateness=300,
            )
            | "Sum amount" >> beam.CombinePerKey(sum)
            | "Format rows" >> beam.Map(
                lambda item: {"customer_id": item[0], "amount": item[1]}
            )
        )

        totals | "Write BigQuery" >> beam.io.WriteToBigQuery(known.output_table)
        parsed[ParseWithDeadLetter.DEAD_LETTER] | "Write dead letters" >> beam.io.WriteToText(
            known.dead_letter_path
        )


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--run", action="store_true")
    args, remaining = cli.parse_known_args()
    if args.run:
        run(remaining)
    else:
        sample = b'{"event_id":"evt-7","event_time":"2026-07-22T08:30:00Z","customer_id":"c-4","amount":19.5}'
        parsed = parse_order(sample)
        assert parsed["customer_id"] == "c-4"
        print(parsed)
