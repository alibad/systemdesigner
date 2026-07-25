type Incident = 'network-jitter' | 'tracking-lost' | 'anchor-conflict';

interface ExperienceState {
  streamedDetail: 'full' | 'reduced' | 'paused';
  worldLockedInteraction: 'enabled' | 'paused';
  sharedAnchorWrites: 'enabled' | 'quarantined';
  userNotice: string;
}

export function degradeFor(incident: Incident): ExperienceState {
  if (incident === 'network-jitter') {
    return {
      streamedDetail: 'reduced',
      worldLockedInteraction: 'enabled',
      sharedAnchorWrites: 'enabled',
      userNotice: 'Visual detail reduced while local tracking remains active.',
    };
  }

  if (incident === 'tracking-lost') {
    return {
      streamedDetail: 'paused',
      worldLockedInteraction: 'paused',
      sharedAnchorWrites: 'quarantined',
      userNotice: 'Move to a trackable area or exit the immersive session.',
    };
  }

  return {
    streamedDetail: 'full',
    worldLockedInteraction: 'enabled',
    sharedAnchorWrites: 'quarantined',
    userNotice: 'Shared placement is reconciling with the trusted local space.',
  };
}
