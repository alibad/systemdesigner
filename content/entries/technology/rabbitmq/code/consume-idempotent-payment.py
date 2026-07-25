import json
from collections.abc import Callable
from typing import Any

import pika


def handle_payment(
    channel: pika.channel.Channel,
    method: pika.spec.Basic.Deliver,
    properties: pika.BasicProperties,
    body: bytes,
    apply_payment: Callable[[str, dict[str, Any]], bool],
) -> None:
    event_id = properties.message_id
    if not event_id:
        channel.basic_reject(method.delivery_tag, requeue=False)
        return

    try:
        event = json.loads(body)
        # apply_payment commits the event ID and business mutation atomically.
        apply_payment(event_id, event)
    except json.JSONDecodeError:
        channel.basic_reject(method.delivery_tag, requeue=False)
        return
    except Exception:
        channel.basic_nack(method.delivery_tag, requeue=True)
        return

    channel.basic_ack(method.delivery_tag)
