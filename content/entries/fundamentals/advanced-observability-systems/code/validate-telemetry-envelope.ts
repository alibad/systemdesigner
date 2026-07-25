type TelemetryEnvelope = {
  serviceName?: string;
  serviceVersion?: string;
  traceId?: string;
  spanId?: string;
  metricExemplarTraceId?: string;
  logTraceId?: string;
  logSpanId?: string;
};

function missingCorrelationFields(envelope: TelemetryEnvelope): string[] {
  const missing: string[] = [];
  if (!envelope.serviceName) missing.push('resource.service.name');
  if (!envelope.serviceVersion) missing.push('resource.service.version');
  if (!envelope.traceId) missing.push('span.trace_id');
  if (!envelope.spanId) missing.push('span.span_id');
  if (envelope.metricExemplarTraceId !== envelope.traceId) {
    missing.push('metric.exemplar.trace_id');
  }
  if (envelope.logTraceId !== envelope.traceId) missing.push('log.trace_id');
  if (envelope.logSpanId !== envelope.spanId) missing.push('log.span_id');
  return missing;
}

const failedCheckout: TelemetryEnvelope = {
  serviceName: 'checkout-api',
  serviceVersion: '2026.07.21-3',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spanId: '00f067aa0ba902b7',
  metricExemplarTraceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  logTraceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  logSpanId: '00f067aa0ba902b7',
};

const missing = missingCorrelationFields(failedCheckout);
if (missing.length > 0) throw new Error(`uncorrelated telemetry: ${missing.join(', ')}`);
console.log('correlation envelope valid');
