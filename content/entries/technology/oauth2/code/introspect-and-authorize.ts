type IntrospectionResponse = {
  active: boolean;
  aud?: string | string[];
  scope?: string;
  client_id?: string;
  sub?: string;
  exp?: number;
};

const asArray = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export async function authorizeOpaqueToken(
  token: string,
  requiredScope: string,
): Promise<{ subject: string; clientId: string }> {
  const response = await fetch('https://issuer.example.com/introspect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Resource-server credentials stay on this server.
      Authorization: `Basic ${process.env.INTROSPECTION_CLIENT_BASIC}`,
    },
    body: new URLSearchParams({ token }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Token introspection unavailable');

  const result = (await response.json()) as IntrospectionResponse;
  const scopes = new Set((result.scope ?? '').split(' ').filter(Boolean));
  const audiences = asArray(result.aud);
  const now = Math.floor(Date.now() / 1000);

  if (!result.active) throw new Error('Inactive access token');
  if (result.exp !== undefined && result.exp <= now) throw new Error('Expired token');
  if (!audiences.includes('https://api.example.com/orders')) {
    throw new Error('Wrong token audience');
  }
  if (!scopes.has(requiredScope)) throw new Error('Missing required scope');
  if (!result.client_id) throw new Error('Missing client binding');

  return {
    subject: result.sub ?? `client:${result.client_id}`,
    clientId: result.client_id,
  };
}
