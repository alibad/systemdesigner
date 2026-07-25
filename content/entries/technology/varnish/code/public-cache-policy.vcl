vcl 4.1;

backend default {
    .host = "app.internal";
    .port = "8080";
}

sub vcl_recv {
    # Only safe, idempotent retrievals are candidates for shared caching.
    if (req.method != "GET" && req.method != "HEAD") {
        return (pass);
    }

    # A shared cache key must never collapse authenticated users together.
    if (req.http.Authorization || req.http.Cookie ~ "(^|;\\s*)(session|auth)=") {
        return (pass);
    }

    return (hash);
}

sub vcl_hash {
    hash_data(req.url);
    hash_data(req.http.host);

    # Vary only on a representation dimension the application supports.
    if (req.http.Accept-Language) {
        hash_data(req.http.Accept-Language);
    }
}

sub vcl_backend_response {
    # The origin remains authoritative about private and non-storable responses.
    if (
        beresp.http.Set-Cookie
        || beresp.http.Cache-Control ~ "(?i)(private|no-store)"
    ) {
        set beresp.uncacheable = true;
        set beresp.ttl = 0s;
        return (deliver);
    }

    set beresp.ttl = 2m;
    set beresp.grace = 10m;
    set beresp.keep = 5m;
    return (deliver);
}

sub vcl_deliver {
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
    } else {
        set resp.http.X-Cache = "MISS";
    }

    # Do not expose internal origin details.
    unset resp.http.Via;
    unset resp.http.X-Varnish;
}
