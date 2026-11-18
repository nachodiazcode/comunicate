export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string | null;
  phone: string | null;
  avatarColor: string;
  avatarEmoji: string;
  avatarUrl?: string | null;
  bio: string;
  status: PresenceStatus;
  customStatus: string | null;
  isBot: boolean;
  isPlaceholder: boolean;
  createdAt: string;
}

export interface Contact {
  id: string;
  ownerId: string;
  contactUserId: string;
  alias: string;
  phone: string | null;
  email: string | null;
  favorite: boolean;
  conversationId: string | null;
  user: User;
  createdAt: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface MessageMetadata {
  durationSec?: number;
  waveform?: number[];
  audioUrl?: string;
  stickerLabel?: string;
  attachmentName?: string;
  sentVia?: "phone" | "email" | "app";
}

export interface ReplyPreview {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  content: string;
  type: MessageType;
}

export type MessageType = "text" | "voice" | "sticker" | "system";
export type TargetType = "dm" | "channel";

export interface Message {
  id: string;
  targetType: TargetType;
  targetId: string;
  senderId: string;
  sender: User;
  content: string;
  type: MessageType;
  replyToId: string | null;
  replyTo: ReplyPreview | null;
  reactions: ReactionGroup[];
  metadata: MessageMetadata | null;
  editedAt: string | null;
  readBy: string[];
  createdAt: string;
}

export interface DmConversation {
  id: string;
  isGroup: boolean;
  title: string | null;
  participants: User[];
  peer: User | null;
  contactAlias: string | null;
  lastMessage: Message | null;
  unreadCount: number;
  pinned: boolean;
  updatedAt: string;
}

export type ChannelType = "text" | "announcement" | "voice";

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  topic: string;
  type: ChannelType;
  category: string;
  position: number;
}

export interface ServerMember {
  userId: string;
  role: "owner" | "admin" | "member";
  roleColor: string;
  user: User;
}

export interface VoiceParticipant {
  userId: string;
  serverId: string;
  channelId: string;
  muted: boolean;
  speaking: boolean;
  joinedAt: string;
  user: User;
}

export interface Server {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  description: string;
  ownerId: string;
  channels: Channel[];
  members: ServerMember[];
  voiceParticipants: VoiceParticipant[];
}

export interface BootstrapPayload {
  currentUser: User;
  availableUsers: User[];
  dms: DmConversation[];
  contacts: Contact[];
  servers: Server[];
}

export type RealtimeEvent =
  | { type: "message:new"; message: Message }
  | { type: "message:updated"; message: Message }
  | {
      type: "message:deleted";
      messageId: string;
      targetType: TargetType;
      targetId: string;
    }
  | {
      type: "message:reaction";
      messageId: string;
      targetType: TargetType;
      targetId: string;
      reactions: ReactionGroup[];
      actorId: string;
      emoji: string;
      added: boolean;
    }
  | {
      type: "typing:update";
      targetType: TargetType;
      targetId: string;
      user: Pick<User, "id" | "name" | "avatarColor">;
      isTyping: boolean;
    }
  | { type: "presence:update"; user: User }
  | {
      type: "dm:read";
      conversationId: string;
      userId: string;
      messageIds: string[];
    }
  | { type: "contact:added"; ownerId: string; contact: Contact; dm: DmConversation }
  | { type: "server:created"; server: Server }
  | { type: "channel:created"; serverId: string; channel: Channel }
  | {
      type: "voice:update";
      serverId: string;
      voiceParticipants: VoiceParticipant[];
    };
