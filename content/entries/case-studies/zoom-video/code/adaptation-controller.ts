type Profile = 'high-detail' | 'balanced' | 'audio-priority';

interface QualityWindow {
  packetLossPercent: number;
  jitterMs: number;
  roundTripMs: number;
  estimatedDownlinkMbps: number;
}

interface Decision {
  profile: Profile;
  protectAudio: boolean;
  reason: string;
}

const nextLower: Record<Profile, Profile> = {
  'high-detail': 'balanced',
  balanced: 'audio-priority',
  'audio-priority': 'audio-priority',
};

const nextHigher: Record<Profile, Profile> = {
  'high-detail': 'high-detail',
  balanced: 'high-detail',
  'audio-priority': 'balanced',
};

export class AdaptationController {
  private badWindows = 0;
  private goodWindows = 0;

  decide(current: Profile, sample: QualityWindow): Decision {
    const severe = sample.packetLossPercent >= 10 || sample.roundTripMs >= 450;
    const constrained =
      sample.packetLossPercent >= 4 ||
      sample.jitterMs >= 40 ||
      sample.estimatedDownlinkMbps < 1.2;
    const recovered =
      sample.packetLossPercent < 2 &&
      sample.jitterMs < 25 &&
      sample.roundTripMs < 250 &&
      sample.estimatedDownlinkMbps >= 2.5;

    this.badWindows = constrained ? this.badWindows + 1 : 0;
    this.goodWindows = recovered ? this.goodWindows + 1 : 0;

    if (severe) {
      this.badWindows = 0;
      this.goodWindows = 0;
      return {
        profile: 'audio-priority',
        protectAudio: true,
        reason: 'Severe loss or delay: preserve speech before video detail.',
      };
    }

    if (this.badWindows >= 2) {
      this.badWindows = 0;
      return {
        profile: nextLower[current],
        protectAudio: true,
        reason: 'Two constrained windows: reduce one video step.',
      };
    }

    if (this.goodWindows >= 5) {
      this.goodWindows = 0;
      return {
        profile: nextHigher[current],
        protectAudio: false,
        reason: 'Five healthy windows: cautiously restore one video step.',
      };
    }

    return {
      profile: current,
      protectAudio: constrained,
      reason: 'Hold the current profile until the evidence is sustained.',
    };
  }
}
