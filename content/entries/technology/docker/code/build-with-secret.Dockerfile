# syntax=docker/dockerfile:1

FROM alpine:3.22 AS fetch
RUN apk add --no-cache curl

# The token exists only for this RUN instruction. It is not copied into a layer.
RUN --mount=type=secret,id=artifact_token \
    curl --fail --silent --show-error \
      --header "Authorization: Bearer $(cat /run/secrets/artifact_token)" \
      --output /tmp/application.tar.gz \
      https://artifacts.example.test/application.tar.gz

FROM scratch
COPY --from=fetch /tmp/application.tar.gz /application.tar.gz
