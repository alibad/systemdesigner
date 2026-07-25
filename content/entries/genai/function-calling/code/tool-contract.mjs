const lookupOrderSchema = {
  type: 'object',
  properties: {
    orderId: { type: 'string', pattern: '^ord_[0-9]{4}$' },
    include: { type: 'string', enum: ['summary', 'shipping_status'] },
  },
  required: ['orderId', 'include'],
  additionalProperties: false,
};

function validateArguments(schema, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['arguments must be an object'];
  }

  const errors = [];
  for (const name of schema.required) {
    if (!(name in input)) errors.push(`${name} is required`);
  }

  for (const [name, value] of Object.entries(input)) {
    const rule = schema.properties[name];
    if (!rule) {
      if (schema.additionalProperties === false) errors.push(`${name} is not allowed`);
      continue;
    }
    if (typeof value !== rule.type) errors.push(`${name} must be a ${rule.type}`);
    if (rule.enum && !rule.enum.includes(value)) errors.push(`${name} is outside the allowed enum`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${name} has an invalid format`);
  }

  return errors;
}

function authorizeLookup({ caller, order }) {
  if (!caller.permissions.includes('orders:read')) return 'missing orders:read permission';
  if (caller.tenantId !== order.tenantId) return 'order belongs to another tenant';
  return null;
}

const proposal = {
  name: 'lookup_order',
  arguments: { orderId: 'ord_1842', include: 'shipping_status' },
};
const caller = { tenantId: 'tenant_alpha', permissions: ['orders:read'] };
const order = { id: 'ord_1842', tenantId: 'tenant_alpha', status: 'in_transit' };

const schemaErrors = validateArguments(lookupOrderSchema, proposal.arguments);
if (schemaErrors.length) throw new Error(`Schema denied: ${schemaErrors.join(', ')}`);

const policyError = authorizeLookup({ caller, order });
if (policyError) throw new Error(`Policy denied: ${policyError}`);

console.log({ status: 'allowed', result: { orderId: order.id, status: order.status } });
