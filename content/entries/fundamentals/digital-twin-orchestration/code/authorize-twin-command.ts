type CommandRequest = {
  commandId: string;
  actorId: string;
  action: 'set-temperature' | 'reset-interlock';
  targetId: string;
  twinVersion: number;
  expiresAt: string;
  approvedBy?: string;
};

type Evidence = {
  actorMayOperateTarget: boolean;
  currentTwinVersion: number;
  localInterlockReady: boolean;
};

export function authorizeCommand(
  request: CommandRequest,
  evidence: Evidence,
  now = new Date(),
): { allowed: boolean; reason: string } {
  if (!evidence.actorMayOperateTarget) {
    return { allowed: false, reason: 'actor-not-authorized-for-target' };
  }
  if (Date.parse(request.expiresAt) <= now.getTime()) {
    return { allowed: false, reason: 'command-expired' };
  }
  if (request.twinVersion !== evidence.currentTwinVersion) {
    return { allowed: false, reason: 'stale-twin-precondition' };
  }
  if (!evidence.localInterlockReady) {
    return { allowed: false, reason: 'local-interlock-blocked' };
  }
  if (request.action === 'reset-interlock' && !request.approvedBy) {
    return { allowed: false, reason: 'human-approval-required' };
  }
  return { allowed: true, reason: 'policy-satisfied' };
}
