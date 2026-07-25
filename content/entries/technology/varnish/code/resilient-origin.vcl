vcl 4.1;

backend default {
    .host = "app.internal";
    .port = "8080";
    .connect_timeout = 1s;
    .first_byte_timeout = 4s;
    .between_bytes_timeout = 2s;
    .probe = {
        .url = "/ready";
        .interval = 5s;
        .timeout = 1s;
        .window = 5;
        .threshold = 3;
    }
}

acl invalidators {
    "127.0.0.1";
    "10.0.0.0"/8;
}

sub vcl_recv {
    if (req.method == "BAN") {
        if (client.ip !~ invalidators) {
            return (synth(403, "Invalidation denied"));
        }

        # The stored metadata gives the ban expression a bounded target.
        ban("obj.http.X-Cache-Path == " + req.url);
        return (synth(200, "Ban accepted"));
    }
}

sub vcl_backend_response {
    set beresp.ttl = 2m;
    set beresp.grace = 10m;
    set beresp.keep = 5m;

    # Store internal metadata for targeted bans, then remove it before delivery.
    set beresp.http.X-Cache-Path = bereq.url;
}

sub vcl_deliver {
    unset resp.http.X-Cache-Path;
}

sub vcl_backend_error {
    # A failed background refresh should leave the stale object available.
    if (bereq.is_bgfetch) {
        return (abandon);
    }

    set beresp.status = 503;
    set beresp.http.Content-Type = "text/plain; charset=utf-8";
    synthetic("The origin path is temporarily unavailable.");
    return (deliver);
}
