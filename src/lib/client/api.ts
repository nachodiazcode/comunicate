"use client";

import type {
  BootstrapPayload,
  Channel,
  ChannelType,
  Contact,
  DmConversation,
  Message,
  MessageMetadata,
  MessageType,
  PresenceStatus,
  ReactionGroup,
  Server,
  TargetType,
  User,
  VoiceParticipant,
} from "@/types/chat";

const TAB_TOKEN_KEY = "comunicate_tab_token";
const DEFAULT_TOKEN_KEY = "comunicate_default_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const tabTok = window.sessionStorage.getItem(TAB_TOKEN_KEY);
  if (tabTok) return tabTok;
  const defTok = window.localStorage.getItem(DEFAULT_TOKEN_KEY);
  if (defTok) {
    window.sessionStorage.setItem(TAB_TOKEN_KEY, defTok);
    return defTok;
  }
  return null;
}

export function setStoredToken(token: string, persistAsDefault = false): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TAB_TOKEN_KEY, token);
  if (persistAsDefault || !window.localStorage.getItem(DEFAULT_TOKEN_KEY)) {
    window.localStorage.setItem(DEFAULT_TOKEN_KEY, token);
  }
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TAB_TOKEN_KEY);
  window.localStorage.removeItem(DEFAULT_TOKEN_KEY);
}

async function apiFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data?.error || `Error HTTP ${res.status}`, res.status);
  }
  return data as T;
}

export async function fetchBootstrap(): Promise<
  BootstrapPayload & { token: string }
> {
  const res = await apiFetch<BootstrapPayload & { token: string }>(
    "/api/bootstrap"
  );
  if (res.token && !getStoredToken()) {
    setStoredToken(res.token, true);
  }
  return res;
}

export async function loginAccount(params: {
  identifier: string;
  password: string;
}): Promise<{ user: User; token: string }> {
  const res = await apiFetch<{ user: User; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setStoredToken(res.token, true);
  return res;
}

export async function registerAccount(params: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  bio?: string;
  avatarColor?: string;
  avatarEmoji?: string;
  avatarUrl?: string;
  persistAsDefault?: boolean;
}): Promise<{ user: User; token: string; claimedExistingInbox: boolean }> {
  const res = await apiFetch<{
    user: User;
    token: string;
    claimedExistingInbox: boolean;
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setStoredToken(res.token, params.persistAsDefault !== false);
  return res;
}

export async function updateMyStatus(params: {
  status?: PresenceStatus;
  customStatus?: string | null;
}): Promise<{ user: User }> {
  return apiFetch<{ user: User }>("/api/auth/status", {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

export async function lookupContacts(q: string): Promise<{ matches: User[] }> {
  return apiFetch<{ matches: User[] }>(
    `/api/contacts/lookup?q=${encodeURIComponent(q)}`
  );
}

export async function addContactApi(params: {
  alias?: string;
  phone?: string;
  email?: string;
  targetUserId?: string;
  initialMessage?: string;
}): Promise<{
  contact: Contact;
  dm: DmConversation;
  initialSentMessage: Message | null;
}> {
  return apiFetch("/api/contacts", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchMessages(
  targetType: TargetType,
  targetId: string
): Promise<{ messages: Message[] }> {
  return apiFetch<{ messages: Message[] }>(
    `/api/messages?targetType=${encodeURIComponent(
      targetType
    )}&targetId=${encodeURIComponent(targetId)}`
  );
}

export async function sendMessageApi(params: {
  targetType: TargetType;
  targetId: string;
  content: string;
  type?: MessageType;
  replyToId?: string | null;
  metadata?: MessageMetadata | null;
}): Promise<{ message: Message }> {
  return apiFetch<{ message: Message }>("/api/messages", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function editMessageApi(
  messageId: string,
  content: string
): Promise<{ message: Message }> {
  return apiFetch<{ message: Message }>(`/api/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

export async function deleteMessageApi(messageId: string): Promise<void> {
  await apiFetch(`/api/messages/${messageId}`, {
    method: "DELETE",
  });
}

export async function toggleReactionApi(
  messageId: string,
  emoji: string
): Promise<{ reactions: ReactionGroup[]; added: boolean }> {
  return apiFetch(`/api/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export async function markDmReadApi(conversationId: string): Promise<void> {
  await apiFetch("/api/messages/read", {
    method: "POST",
    body: JSON.stringify({ conversationId }),
  });
}

export async function sendTypingApi(
  targetType: TargetType,
  targetId: string,
  isTyping: boolean
): Promise<void> {
  await apiFetch("/api/typing", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, isTyping }),
  }).catch(() => {});
}

export async function createServerApi(params: {
  name: string;
  icon?: string;
  gradient?: string;
  description?: string;
}): Promise<{ server: Server }> {
  return apiFetch<{ server: Server }>("/api/servers", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function createChannelApi(
  serverId: string,
  params: {
    name: string;
    topic?: string;
    type?: ChannelType;
  }
): Promise<{ channel: Channel }> {
  return apiFetch<{ channel: Channel }>(`/api/servers/${serverId}/channels`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function updateVoiceApi(
  serverId: string,
  params: {
    channelId: string | null;
    muted?: boolean;
    speaking?: boolean;
  }
): Promise<{ voiceParticipants: VoiceParticipant[] }> {
  return apiFetch<{ voiceParticipants: VoiceParticipant[] }>(
    `/api/servers/${serverId}/voice`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
}
