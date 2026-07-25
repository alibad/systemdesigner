import assert from 'node:assert/strict';

const policies = {
  type: { allowedRisk: ['low', 'medium'], requiresApproval: false },
  submit: { allowedRisk: ['medium', 'high'], requiresApproval: true },
};

function compileAction({ observation, proposal, approval }) {
  assert.equal(proposal.observationId, observation.id, 'proposal must cite the current observation');
  assert.equal(observation.origin, proposal.expectedOrigin, 'origin changed after planning');
  assert.equal(observation.targetMatches, 1, 'target must resolve exactly once');
  assert.ok(observation.ageMs <= 2_000, 'observation is stale');
  assert.equal(proposal.actions.length, 1, 'execute one bounded action before re-observing');

  const [action] = proposal.actions;
  const policy = policies[action.type];
  assert.ok(policy, `unsupported action type: ${action.type}`);
  assert.ok(policy.allowedRisk.includes(action.risk), 'risk exceeds the action policy');

  if (policy.requiresApproval) {
    assert.equal(approval?.actionId, action.id, 'approval must name this exact action');
    assert.equal(approval?.target, action.target, 'approval target changed');
  }

  return {
    ...action,
    observationId: observation.id,
    expectedPostcondition: proposal.expectedPostcondition,
  };
}

const observation = {
  id: 'obs-104',
  ageMs: 420,
  origin: 'https://billing.example.test',
  targetMatches: 1,
};

const proposal = {
  observationId: 'obs-104',
  expectedOrigin: 'https://billing.example.test',
  expectedPostcondition: 'The invoice status becomes sent and a message ID appears.',
  actions: [
    {
      id: 'action-send-invoice-1842',
      type: 'submit',
      target: 'button[name="Send invoice 1842"]',
      risk: 'high',
    },
  ],
};

const approval = {
  actionId: 'action-send-invoice-1842',
  target: 'button[name="Send invoice 1842"]',
};

console.log(compileAction({ observation, proposal, approval }));
