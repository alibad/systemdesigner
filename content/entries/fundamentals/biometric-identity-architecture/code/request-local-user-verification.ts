type AuthenticationOptions = {
  challenge: string;
  rpId: string;
  timeoutMs: number;
  credentialIds: string[];
};

type AssertionEnvelope = {
  id: string;
  rawId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  userHandle: string | null;
};

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export async function requestLocalUserVerification(
  options: AuthenticationOptions,
): Promise<AssertionEnvelope> {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: decodeBase64Url(options.challenge),
      rpId: options.rpId,
      timeout: options.timeoutMs,
      userVerification: 'required',
      allowCredentials: options.credentialIds.map((id) => ({
        id: decodeBase64Url(id),
        type: 'public-key',
        transports: ['internal', 'hybrid'],
      })),
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('The authenticator did not return a public-key credential.');
  }

  const response = credential.response;
  if (!(response instanceof AuthenticatorAssertionResponse)) {
    throw new Error('The credential response is not an authentication assertion.');
  }

  // The browser receives only the signed assertion. It never receives a face,
  // fingerprint, matching score, or biometric template through WebAuthn.
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    authenticatorData: encodeBase64Url(response.authenticatorData),
    clientDataJSON: encodeBase64Url(response.clientDataJSON),
    signature: encodeBase64Url(response.signature),
    userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null,
  };
}

/*
 * Send the envelope to the server. A maintained WebAuthn verifier must validate
 * the stored challenge, expected origin, RP ID, signature, sign counter policy,
 * credential state, and the signed user-verification (UV) flag before creating
 * a session. Never accept a client-supplied "biometric succeeded" boolean.
 */
