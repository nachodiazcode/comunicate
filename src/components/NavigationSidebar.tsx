"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCheck,
  Hash,
  Mail,
  Megaphone,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Pin,
  Plus,
  Radio,
  Search,
  Sparkles,
  UserPlus,
  Volume2,
} from "lucide-react";
import type {
  Channel,
  Contact,
  DmConversation,
  PresenceStatus,
  Server,
  TargetType,
  User,
} from "@/types/chat";
import { UserAvatar } from "./UserAvatar";

interface NavigationSidebarProps {
  activeArea: "dms" | string;
  dms: DmConversation[];
  contacts: Contact[];
  activeServer: Server | null;
  selectedTarget: { type: TargetType; id: string } | null;
  currentUser: User;
  typingByTarget: Record<string, string[]>;
  onSelectTarget: (type: TargetType, id: string) => void;
  onOpenAddContact: () => void;
  onOpenCreateChannel: (serverId: string) => void;
  onJoinOrLeaveVoice: (
    serverId: string,
    channelId: string | null,
    muted?: boolean,
    speaking?: boolean
  ) => void;
  onStartDmWithContact: (contact: Contact) => void;
  onChangeStatus: (status: PresenceStatus) => void;
  onOpenAccountModal: () => void;
}

export function NavigationSidebar({
  activeArea,
  dms,
  contacts,
  activeServer,
  selectedTarget,
  currentUser,
  typingByTarget,
  onSelectTarget,
  onOpenAddContact,
  onOpenCreateChannel,
  onJoinOrLeaveVoice,
  onStartDmWithContact,
  onChangeStatus,
  onOpenAccountModal,
}: NavigationSidebarProps) {
  const [search, setSearch] = useState("");
  const [dmTab, setDmTab] = useState<"all" | "unread" | "contacts">("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const filteredDms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dms.filter((dm) => {
      if (dmTab === "unread" && dm.unreadCount === 0) return false;
      if (!q) return true;
      const peerName = (dm.contactAlias || dm.peer?.name || "").toLowerCase();
      const peerPhone = (dm.peer?.phone || "").toLowerCase();
      const peerEmail = (dm.peer?.email || "").toLowerCase();
      const lastContent = (dm.lastMessage?.content || "").toLowerCase();
      return (
        peerName.includes(q) ||
        peerPhone.includes(q) ||
        peerEmail.includes(q) ||
        lastContent.includes(q)
      );
    });
  }, [dms, dmTab, search]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.alias.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        c.user.name.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Check if currentUser is in a voice channel inside activeServer
  const myVoiceState = useMemo(() => {
    if (!activeServer) return null;
    return (
      activeServer.voiceParticipants.find(
        (vp) => vp.userId === currentUser.id
      ) ?? null
    );
  }, [activeServer, currentUser.id]);

  const groupedChannels = useMemo(() => {
    if (!activeServer) return [];
    const map = new Map<string, Channel[]>();
    for (const ch of activeServer.channels) {
      const arr = map.get(ch.category) ?? [];
      arr.push(ch);
      map.set(ch.category, arr);
    }
    return Array.from(map.entries());
  }, [activeServer]);

  return (
    <div className="w-full md:w-[310px] lg:w-[326px] shrink-0 h-full bg-[#111420] border-r border-white/[0.06] flex flex-col select-none">
      {activeArea === "dms" ? (
        <>
          {/* DMs Header */}
          <div className="p-3.5 pb-2.5 border-b border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[15px] font-bold tracking-tight text-white flex items-center gap-1.5">
                  <span>Comunicate</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
                    Directo
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400">
                  Chats por número, correo o usuario
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={onOpenAddContact}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </motion.button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, +número o @correo..."
                className="w-full bg-[#0b0d14]/90 border border-white/[0.07] focus:border-indigo-500/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition"
              />
            </div>

            {/* Segmented Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0b0d14]/80 border border-white/[0.05]">
              {(
                [
                  { id: "all", label: "Chats" },
                  { id: "unread", label: "No leídos" },
                  { id: "contacts", label: `Agenda (${contacts.length})` },
                ] as const
              ).map((tab) => {
                const active = dmTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDmTab(tab.id)}
                    className={`relative py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      active
                        ? "text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="dm-tab-pill"
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 32,
                        }}
                        className="absolute inset-0 rounded-lg bg-[#1c2135] border border-white/[0.08]"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DM Conversations or Contacts List */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {dmTab === "contacts" ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenAddContact}
                  className="w-full mb-2 p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-400/20 flex items-center gap-2.5 text-left transition cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-200">
                      Nuevo número o correo
                    </div>
                    <div className="text-[11px] text-emerald-300/75 truncate">
                      Enviar mensaje como WhatsApp o Email
                    </div>
                  </div>
                </motion.button>

                {filteredContacts.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => onStartDmWithContact(c)}
                    className="p-2.5 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] flex items-center gap-3 cursor-pointer transition group"
                  >
                    <UserAvatar user={c.user} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {c.alias}
                        </span>
                        {c.user.isPlaceholder && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/20">
                            Externo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {c.phone && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                            <Phone className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                            <Mail className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                            {c.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            ) : (
              <AnimatePresence initial={false}>
                {filteredDms.map((dm) => {
                  const isSelected =
                    selectedTarget?.type === "dm" &&
                    selectedTarget.id === dm.id;
                  const peer = dm.peer ?? currentUser;
                  const displayName =
                    dm.contactAlias || dm.title || peer.name || "Chat";
                  const typingNames =
                    typingByTarget[`dm:${dm.id}`]?.filter(
                      (n) => n !== currentUser.name
                    ) ?? [];
                  const lastMsg = dm.lastMessage;
                  const isLastMine = lastMsg?.senderId === currentUser.id;
                  const isLastRead =
                    isLastMine &&
                    lastMsg &&
                    peer &&
                    lastMsg.readBy.includes(peer.id);

                  return (
                    <motion.button
                      key={dm.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 34,
                      }}
                      onClick={() => onSelectTarget("dm", dm.id)}
                      className={`w-full p-2.5 rounded-2xl flex items-center gap-3 text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-gradient-to-r from-indigo-500/22 via-violet-500/14 to-transparent border border-indigo-400/30 shadow-sm"
                          : "hover:bg-white/[0.045] border border-transparent"
                      }`}
                    >
                      <UserAvatar user={peer} size="md" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] font-semibold text-slate-100 truncate">
                              {displayName}
                            </span>
                            {peer.isBot && (
                              <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                            )}
                            {dm.pinned && (
                              <Pin className="w-2.5 h-2.5 text-slate-500 rotate-45 shrink-0" />
                            )}
                          </div>
                          {lastMsg && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatShortTime(lastMsg.createdAt)}
                            </span>
                          )}
                        </div>

                        {/* Phone / Email micro-pills */}
                        {(peer.phone || peer.email) && (
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400/90 truncate">
                            {peer.phone && (
                              <span className="inline-flex items-center gap-0.5 truncate">
                                <Phone className="w-2.5 h-2.5 text-emerald-400/80 shrink-0" />
                                {peer.phone}
                              </span>
                            )}
                            {!peer.phone && peer.email && (
                              <span className="inline-flex items-center gap-0.5 truncate">
                                <Mail className="w-2.5 h-2.5 text-sky-400/80 shrink-0" />
                                {peer.email}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-1">
                          {typingNames.length > 0 ? (
                            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 truncate">
                              <span className="inline-flex gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" />
                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:120ms]" />
                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:240ms]" />
                              </span>
                              escribiendo...
                            </span>
                          ) : lastMsg ? (
                            <span className="text-xs text-slate-400 truncate flex items-center gap-1">
                              {isLastMine && (
                                <CheckCheck
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isLastRead
                                      ? "text-cyan-400"
                                      : "text-slate-500"
                                  }`}
                                />
                              )}
                              <span className="truncate">
                                {lastMsg.type === "sticker"
                                  ? `${lastMsg.content} Sticker`
                                  : lastMsg.type === "voice"
                                  ? "🎙️ Nota de voz"
                                  : lastMsg.content}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 italic">
                               Chat listo para escribir ✨
                            </span>
                          )}

                          {dm.unreadCount > 0 && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="min-w-5 h-5 px-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-[10px] font-bold text-white flex items-center justify-center shrink-0 shadow"
                            >
                              {dm.unreadCount}
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}

                {filteredDms.length === 0 && (
                  <div className="py-10 px-4 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No hay conversaciones que coincidan.
                    </p>
                    <button
                      onClick={onOpenAddContact}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      + Agregar un número o correo nuevo
                    </button>
                  </div>
                )}
              </AnimatePresence>
            )}
          </div>
        </>
      ) : activeServer ? (
        <>
          {/* Discord-Style Server Banner Header */}
          <div className="relative overflow-hidden p-4 border-b border-white/[0.06]">
            <div
              className={`absolute inset-0 bg-gradient-to-br ${activeServer.gradient} opacity-15 pointer-events-none`}
            />
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl">{activeServer.icon}</span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate">
                    {activeServer.name}
                  </h2>
                  <p className="text-[11px] text-slate-400 truncate">
                    {activeServer.members.length} miembros · Comunidad
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onOpenCreateChannel(activeServer.id)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center justify-center cursor-pointer"
                title="Crear nuevo canal"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Categorized Channels List */}
          <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
            {groupedChannels.map(([category, channels]) => (
              <div key={category} className="space-y-1">
                <div className="px-2 flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-400/85 uppercase">
                  <span>{category}</span>
                  <button
                    onClick={() => onOpenCreateChannel(activeServer.id)}
                    className="hover:text-white transition cursor-pointer"
                    title="Agregar canal"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {channels.map((ch) => {
                  const isVoice = ch.type === "voice";
                  const isSelected =
                    selectedTarget?.type === "channel" &&
                    selectedTarget.id === ch.id;
                  const voiceUsers = isVoice
                    ? activeServer.voiceParticipants.filter(
                        (vp) => vp.channelId === ch.id
                      )
                    : [];
                  const amInThisVoice = voiceUsers.some(
                    (vp) => vp.userId === currentUser.id
                  );

                  return (
                    <div key={ch.id} className="space-y-1">
                      <motion.button
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (isVoice) {
                            onJoinOrLeaveVoice(
                              activeServer.id,
                              amInThisVoice ? null : ch.id,
                              false,
                              true
                            );
                          } else {
                            onSelectTarget("channel", ch.id);
                          }
                        }}
                        className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                          isSelected
                            ? "bg-indigo-500/20 text-white border border-indigo-400/25"
                            : amInThisVoice
                            ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/25"
                            : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {ch.type === "voice" ? (
                            <Volume2
                              className={`w-4 h-4 shrink-0 ${
                                voiceUsers.length > 0
                                  ? "text-emerald-400"
                                  : "text-slate-400"
                              }`}
                            />
                          ) : ch.type === "announcement" ? (
                            <Megaphone className="w-4 h-4 shrink-0 text-amber-400" />
                          ) : (
                            <Hash className="w-4 h-4 shrink-0 text-indigo-400/80" />
                          )}
                          <span className="text-[13px] font-medium truncate">
                            {ch.name}
                          </span>
                        </div>

                        {isVoice && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                              amInThisVoice
                                ? "bg-emerald-500/25 text-emerald-200"
                                : "bg-white/[0.05] text-slate-400"
                            }`}
                          >
                            {amInThisVoice ? "Conectado" : "Unirse"}
                          </span>
                        )}
                      </motion.button>

                      {/* Connected Voice Lounge Members */}
                      {isVoice && voiceUsers.length > 0 && (
                        <div className="pl-7 pr-2 py-1 space-y-1.5">
                          {voiceUsers.map((vp) => (
                            <motion.div
                              key={vp.userId}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center justify-between gap-2 text-xs text-slate-300"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <UserAvatar
                                  user={vp.user}
                                  size="xs"
                                  showStatus={false}
                                  speaking={vp.speaking && !vp.muted}
                                />
                                <span className="truncate text-[12px]">
                                  {vp.user.name}
                                </span>
                              </div>
                              {vp.muted ? (
                                <MicOff className="w-3 h-3 text-rose-400 shrink-0" />
                              ) : vp.speaking ? (
                                <Radio className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
                              ) : null}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Active Voice Connection Pod (Discord Bottom Voice Bar) */}
          <AnimatePresence>
            {myVoiceState && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-3 py-2.5 bg-emerald-950/35 border-t border-emerald-500/20 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Voz Conectada
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {activeServer.channels.find(
                      (c) => c.id === myVoiceState.channelId
                    )?.name ?? "Sala de Voz"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      onJoinOrLeaveVoice(
                        activeServer.id,
                        myVoiceState.channelId,
                        !myVoiceState.muted,
                        myVoiceState.muted
                      )
                    }
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      myVoiceState.muted
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-white/10 text-slate-200 hover:bg-white/15"
                    }`}
                    title={myVoiceState.muted ? "Activar micrófono" : "Silenciar"}
                  >
                    {myVoiceState.muted ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      onJoinOrLeaveVoice(activeServer.id, null)
                    }
                    className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 transition cursor-pointer"
                    title="Desconectar de sala de voz"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : null}

      {/* Bottom User Profile & Presence Pod */}
      <div className="p-2.5 bg-[#0c0f18] border-t border-white/[0.06] relative">
        <AnimatePresence>
          {statusMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              className="absolute bottom-16 left-2.5 right-2.5 z-40 rounded-2xl bg-[#161b2c] border border-white/10 shadow-2xl p-2 space-y-1"
            >
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Estado de presencia
              </div>
              {(
                [
                  { id: "online", label: "En línea", dot: "bg-emerald-400" },
                  { id: "idle", label: "Ausente", dot: "bg-amber-400" },
                  { id: "dnd", label: "No molestar", dot: "bg-rose-500" },
                  { id: "offline", label: "Invisible", dot: "bg-slate-500" },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    onChangeStatus(st.id);
                    setStatusMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer"
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                  <span>{st.label}</span>
                </button>
              ))}
              <div className="border-t border-white/[0.07] my-1 pt-1">
                <button
                  onClick={() => {
                    setStatusMenuOpen(false);
                    onOpenAccountModal();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold text-left cursor-pointer"
                >
                  ⇄ Cambiar o registrar cuenta (Multi-pestaña)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setStatusMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 min-w-0 flex-1 p-1 rounded-xl hover:bg-white/[0.05] transition text-left cursor-pointer"
          >
            <UserAvatar user={currentUser} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {currentUser.phone || currentUser.email || currentUser.handle}
              </div>
            </div>
          </button>

          <button
            onClick={onOpenAccountModal}
            className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-medium text-slate-200 transition cursor-pointer shrink-0"
            title="Cambiar de cuenta en esta pestaña para probar chat en tiempo real"
          >
            Cuenta
          </button>
        </div>
      </div>
    </div>
  );
}

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
