type DurableUpdate = {
  kind: 'document-update';
  documentId: string;
  changeId: string;
  actorId: string;
  payload: Uint8Array;
};

type AwarenessUpdate = {
  kind: 'awareness';
  documentId: string;
  clientId: string;
  clock: number;
  payload: Uint8Array;
};

type Session = {
  clientId: string;
  actorId: string;
  documentId: string;
  canEdit: boolean;
  send(message: DurableUpdate | AwarenessUpdate): void;
};

interface DurableJournal {
  appendIfAbsent(update: DurableUpdate): Promise<'appended' | 'existing'>;
}

interface MergeEngine {
  validate(update: DurableUpdate): Promise<void>;
  applyIdempotently(update: DurableUpdate): Promise<void>;
}

export class CollaborationRoom {
  private readonly sessions = new Map<string, Session>();
  private readonly awarenessClock = new Map<string, number>();

  constructor(
    private readonly documentId: string,
    private readonly journal: DurableJournal,
    private readonly mergeEngine: MergeEngine,
  ) {}

  join(session: Session): void {
    if (session.documentId !== this.documentId) {
      throw new Error('Session is not authorized for this document');
    }
    this.sessions.set(session.clientId, session);
  }

  async receive(sender: Session, message: DurableUpdate | AwarenessUpdate): Promise<void> {
    if (sender.documentId !== this.documentId || message.documentId !== this.documentId) {
      throw new Error('Cross-document message rejected');
    }

    if (message.kind === 'document-update') {
      await this.applyDurableUpdate(sender, message);
      return;
    }

    this.applyAwarenessUpdate(sender, message);
  }

  private async applyDurableUpdate(sender: Session, update: DurableUpdate): Promise<void> {
    if (!sender.canEdit || update.actorId !== sender.actorId) {
      throw new Error('Durable update is not authorized');
    }

    await this.mergeEngine.validate(update);

    // The unique changeId makes the journal append atomic under concurrent retries.
    const appendResult = await this.journal.appendIfAbsent(update);
    await this.mergeEngine.applyIdempotently(update);

    // A durable append is the acknowledgement boundary. Existing changes are
    // acknowledged again to let a retry complete without rebroadcasting it.
    if (appendResult === 'existing') {
      sender.send(update);
      return;
    }

    sender.send(update);
    this.broadcast(sender.clientId, update);
  }

  private applyAwarenessUpdate(sender: Session, update: AwarenessUpdate): void {
    if (update.clientId !== sender.clientId) {
      throw new Error('Awareness identity does not match the session');
    }

    const previousClock = this.awarenessClock.get(sender.clientId) ?? -1;
    if (update.clock <= previousClock) return; // Drop duplicate or stale presence.

    this.awarenessClock.set(sender.clientId, update.clock);
    this.broadcast(sender.clientId, update); // Presence is intentionally not journaled.
  }

  private broadcast(senderClientId: string, message: DurableUpdate | AwarenessUpdate): void {
    for (const [clientId, session] of this.sessions) {
      if (clientId !== senderClientId) session.send(message);
    }
  }
}
