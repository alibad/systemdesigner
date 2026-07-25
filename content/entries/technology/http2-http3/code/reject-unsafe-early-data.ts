type RequestShape = {
  method: string;
  earlyData: boolean;
};

type Admission = {
  accepted: boolean;
  status: 200 | 425;
  reason: string;
};

const replaySafeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function admitEarlyData(request: RequestShape): Admission {
  if (!request.earlyData || replaySafeMethods.has(request.method.toUpperCase())) {
    return { accepted: true, status: 200, reason: 'Request can enter normal routing.' };
  }

  return {
    accepted: false,
    status: 425,
    reason: 'Retry after handshake confirmation; this operation is not replay-safe.',
  };
}
