CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}'
  VALID UNTIL '{{expiration}}';

GRANT CONNECT ON DATABASE payments TO "{{name}}";
GRANT USAGE ON SCHEMA reporting TO "{{name}}";
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO "{{name}}";
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting
  GRANT SELECT ON TABLES TO "{{name}}";
