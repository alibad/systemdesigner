'use strict';

function createPeerConnection({ PeerConnection, signal, onRemoteTrack }) {
  if (typeof PeerConnection !== 'function') {
    throw new TypeError('PeerConnection constructor is required');
  }

  const connection = new PeerConnection({
    iceServers: [
      { urls: ['stun:stun.example.net:3478'] },
      {
        urls: [
          'turn:turn.example.net:3478?transport=udp',
          'turns:turn.example.net:443?transport=tcp',
        ],
        username: 'short-lived-session-user',
        credential: 'short-lived-session-secret',
      },
    ],
  });

  connection.onicecandidate = ({ candidate }) => {
    if (candidate) signal({ type: 'ice-candidate', candidate });
  };
  connection.ontrack = ({ streams }) => onRemoteTrack(streams[0]);
  return connection;
}

async function publishOffer(connection, signal) {
  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  signal({ type: 'offer', description: connection.localDescription });
}

async function applySignal(connection, message) {
  if (message.type === 'ice-candidate') {
    await connection.addIceCandidate(message.candidate);
    return;
  }

  await connection.setRemoteDescription(message.description);
  if (message.description.type === 'offer') {
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    return { type: 'answer', description: connection.localDescription };
  }
}

export { applySignal, createPeerConnection, publishOffer };

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('/negotiate-peer-connection.js')) {
  class FakePeerConnection {
    constructor(configuration) {
      this.configuration = configuration;
      this.localDescription = null;
    }

    async createOffer() {
      return { type: 'offer', sdp: 'v=0\r\n' };
    }

    async setLocalDescription(description) {
      this.localDescription = description;
    }
  }

  const sent = [];
  const connection = createPeerConnection({
    PeerConnection: FakePeerConnection,
    signal: (message) => sent.push(message),
    onRemoteTrack: () => {},
  });

  publishOffer(connection, (message) => sent.push(message)).then(() => {
    console.assert(connection.configuration.iceServers.length === 2);
    console.assert(sent[0].type === 'offer');
    console.log('offer published with STUN and TURN fallback');
  });
}
