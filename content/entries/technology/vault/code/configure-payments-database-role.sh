vault write database/config/payments \
  plugin_name=postgresql-database-plugin \
  allowed_roles=payments-reader \
  connection_url='postgresql://{{username}}:{{password}}@db.internal/payments?sslmode=verify-full' \
  username="$VAULT_DB_ADMIN_USER" \
  password="$VAULT_DB_ADMIN_PASSWORD"

vault write database/roles/payments-reader \
  db_name=payments \
  default_ttl=20m \
  max_ttl=2h \
  creation_statements=@payments-reader-create.sql \
  revocation_statements='ALTER ROLE "{{name}}" NOLOGIN; DROP ROLE IF EXISTS "{{name}}";'
