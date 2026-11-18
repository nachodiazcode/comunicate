import type { RealtimeEvent, User, VoiceParticipant } from "@/types/chat";

type EventListener = (event: RealtimeEvent) => void;

interface EventHubState {
  listeners: Set<EventListener>;
  voiceMap: Map<string, VoiceParticipant>; // key: userId
}

const globalForEvents = globalThis as unknown as {
  __comunicateEventHub?: EventHubState;
};

function getHub(): EventHubState {
  if (!globalForEvents.__comunicateEventHub) {
    globalForEvents.__comunicateEventHub = {
      listeners: new Set<EventListener>(),
      voiceMap: new Map<string, VoiceParticipant>(),
    };
  }
  return globalForEvents.__comunicateEventHub;
}

export function subscribeEvents(listener: EventListener): () => void {
  const hub = getHub();
  hub.listeners.add(listener);
  return () => {
    hub.listeners.delete(listener);
  };
}

export function emitRealtimeEvent(event: RealtimeEvent): void {
  const hub = getHub();
  for (const listener of hub.listeners) {
    try {
      listener(event);
    } catch {
      // Ignore closed stream errors
    }
  }
}

export function getServerVoiceParticipants(serverId: string): VoiceParticipant[] {
  const hub = getHub();
  const list: VoiceParticipant[] = [];
  for (const vp of hub.voiceMap.values()) {
    if (vp.serverId === serverId) {
      list.push(vp);
    }
  }
  return list;
}

export function seedDefaultVoiceParticipants(usersById: Map<string, User>): void {
  const hub = getHub();
  if (hub.voiceMap.size > 0) return;

  const sofia = usersById.get("user_sofia");
  const mateo = usersById.get("user_mateo");
  if (sofia) {
    hub.voiceMap.set(sofia.id, {
      userId: sofia.id,
      serverId: "srv_design",
      channelId: "ch_design_voice_creative",
      muted: false,
      speaking: true,
      joinedAt: new Date().toISOString(),
      user: sofia,
    });
  }
  if (mateo) {
    hub.voiceMap.set(mateo.id, {
      userId: mateo.id,
      serverId: "srv_devs",
      channelId: "ch_devs_voice_standup",
      muted: false,
      speaking: false,
      joinedAt: new Date().toISOString(),
      user: mateo,
    });
  }
}

export function updateVoiceState(params: {
  user: User;
  serverId: string;
  channelId: string | null;
  muted?: boolean;
  speaking?: boolean;
}): VoiceParticipant[] {
  const hub = getHub();
  const existing = hub.voiceMap.get(params.user.id);
  const prevServerId = existing?.serverId;

  if (!params.channelId) {
    hub.voiceMap.delete(params.user.id);
    if (prevServerId && prevServerId !== params.serverId) {
      emitRealtimeEvent({
        type: "voice:update",
        serverId: prevServerId,
        voiceParticipants: getServerVoiceParticipants(prevServerId),
      });
    }
    const updated = getServerVoiceParticipants(params.serverId);
    emitRealtimeEvent({
      type: "voice:update",
      serverId: params.serverId,
      voiceParticipants: updated,
    });
    return updated;
  }

  hub.voiceMap.set(params.user.id, {
    userId: params.user.id,
    serverId: params.serverId,
    channelId: params.channelId,
    muted: params.muted ?? existing?.muted ?? false,
    speaking: params.speaking ?? existing?.speaking ?? false,
    joinedAt: existing?.joinedAt ?? new Date().toISOString(),
    user: params.user,
  });

  if (prevServerId && prevServerId !== params.serverId) {
    emitRealtimeEvent({
      type: "voice:update",
      serverId: prevServerId,
      voiceParticipants: getServerVoiceParticipants(prevServerId),
    });
  }

  const updated = getServerVoiceParticipants(params.serverId);
  emitRealtimeEvent({
    type: "voice:update",
    serverId: params.serverId,
    voiceParticipants: updated,
  });
  return updated;
}
