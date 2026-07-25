from struct import pack, unpack


def encode(message: bytes) -> bytes:
    return pack("!I", len(message)) + message


def decode(buffer: bytes) -> tuple[list[bytes], bytes]:
    messages: list[bytes] = []
    offset = 0
    while len(buffer) - offset >= 4:
        length = unpack("!I", buffer[offset:offset + 4])[0]
        if len(buffer) - offset - 4 < length:
            break
        start = offset + 4
        messages.append(buffer[start:start + length])
        offset = start + length
    return messages, buffer[offset:]


if __name__ == "__main__":
    wire = encode(b"first") + encode(b"second")
    first_batch, remainder = decode(wire[:10])
    second_batch, remainder = decode(remainder + wire[10:])
    assert first_batch + second_batch == [b"first", b"second"]
    assert remainder == b""
    print("framing preserved two messages across arbitrary reads")
