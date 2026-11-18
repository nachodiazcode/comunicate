"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import type {
  BootstrapPayload,
  Channel,
  Contact,
  DmConversation,
  Message,
  MessageMetadata,
  MessageType,
  PresenceStatus,
  RealtimeEvent,
  Server,
  TargetType,
  User,
} from "@/types/chat";
import {
  addContactApi,
  deleteMessageApi,
  editMessageApi,
  ApiError,
  clearStoredToken,
  fetchBootstrap,
  fetchMessages,
  getStoredToken,
  markDmReadApi,
  sendMessageApi,
  sendTypingApi,
  toggleReactionApi,
  updateMyStatus,
  updateVoiceApi,
} from "@/lib/client/api";
import {
  playIncomingChime,
  playReactionSparkle,
  playSendPop,
} from "@/lib/client/sound";
import { ServerRail } from "./ServerRail";
import { NavigationSidebar } from "./NavigationSidebar";
import { ChatStage } from "./ChatStage";
import { AddContactModal } from "./AddContactModal";
import { AuthAccountModal } from "./AuthAccountModal";
import { LoginScreen } from "./LoginScreen";
import { CreateChannelModal, CreateServerModal } from "./CreateServerModal";
import { RightDetailsDrawer } from "./RightDetailsDrawer";
import { CallOverlayModal } from "./CallOverlayModal";

export function ComunicateApp() {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [activeArea, setActiveArea] = useState<"dms" | string>("dms");
  const [selectedTarget, setSelectedTarget] = useState<{
    type: TargetType;
    id: string;
  } | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [typingByTarget, setTypingByTarget] = useState<
    Record<string, string[]>
  >({});
  const [burstState, setBurstState] = useState<
    Record<string, { emoji: string; seq: number }>
  >({});

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [createServerOpen, setCreateServerOpen] = useState(false);
  const [createChannelServerId, setCreateChannelServerId] = useState<
    string | null
  >(null);
  const [callState, setCallState] = useState<{
    peer: User;
    mode: "audio" | "video";
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [serverlessPoll, setServerlessPoll] = useState(false);

  const selectedTargetRef = useRef(selectedTarget);
  const currentUserRef = useRef<User | null>(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    selectedTargetRef.current = selectedTarget;
  }, [selectedTarget]);

  useEffect(() => {
    currentUserRef.current = data?.currentUser ?? null;
  }, [data?.currentUser]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  const applyBootstrapResult = useCallback(
    (
      res: BootstrapPayload & { token: string },
      preserveSelection = false
    ) => {
      setData({
        currentUser: res.currentUser,
        availableUsers: res.availableUsers,
        dms: res.dms,
        contacts: res.contacts,
        servers: res.servers,
      });

      if (!preserveSelection || !selectedTargetRef.current) {
        if (res.dms.length > 0) {
          setActiveArea("dms");
          setSelectedTarget({ type: "dm", id: res.dms[0].id });
        } else if (res.servers.length > 0) {
          const firstSrv = res.servers[0];
          const firstCh = firstSrv.channels.find((c) => c.type !== "voice");
          setActiveArea(firstSrv.id);
          if (firstCh) {
            setSelectedTarget({ type: "channel", id: firstCh.id });
          }
        }
      }
    },
    []
  );

  const loadWorkspace = useCallback(
    async (preserveSelection = false) => {
      const res = await fetchBootstrap();
      applyBootstrapResult(res, preserveSelection);
    },
    [applyBootstrapResult]
  );

  useEffect(() => {
    let active = true;
    fetchBootstrap()
      .then((res) => {
        if (!active) return;
        applyBootstrapResult(res, false);
        setNeedsLogin(false);
        setBootError(null);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          clearStoredToken();
          setNeedsLogin(true);
          return;
        }
        setBootError(
          err instanceof Error ? err.message : "No se pudo abrir Comunicate"
        );
      });
    return () => {
      active = false;
    };
  }, [applyBootstrapResult]);

  // Load messages whenever selectedTarget changes
  useEffect(() => {
    if (!selectedTarget) return;
    let cancelled = false;

    fetchMessages(selectedTarget.type, selectedTarget.id)
      .then((res) => {
        if (cancelled) return;
        setMessages(res.messages);
        if (selectedTarget.type === "dm") {
          markDmReadApi(selectedTarget.id).catch(() => {});
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  dms: prev.dms.map((d) =>
                    d.id === selectedTarget.id ? { ...d, unreadCount: 0 } : d
                  ),
                }
              : prev
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedTarget]);

  // Real-time SSE Event Stream Subscription
  useEffect(() => {
    if (!data?.currentUser.id) return;
    const tok = getStoredToken() ?? "";
    const es = new EventSource(
      `/api/events?token=${encodeURIComponent(tok)}`
    );

    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as
          | RealtimeEvent
          | { type: "connected" }
          | { type: "serverless_poll_mode" };
        if (parsed.type === "connected") return;
        if (parsed.type === "serverless_poll_mode") {
          es.close();
          setServerlessPoll(true);
          return;
        }

        const me = currentUserRef.current;
        const activeTarget = selectedTargetRef.current;

        switch (parsed.type) {
          case "message:new": {
            const msg = parsed.message;
            const isCurrentChat =
              activeTarget?.type === msg.targetType &&
              activeTarget?.id === msg.targetId;

            if (isCurrentChat) {
              setMessages((prev) =>
                prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
              );
              if (
                msg.targetType === "dm" &&
                me &&
                msg.senderId !== me.id
              ) {
                markDmReadApi(msg.targetId).catch(() => {});
              }
            }

            if (me && msg.senderId !== me.id) {
              playIncomingChime(soundEnabledRef.current);
              if (!isCurrentChat && msg.targetType === "dm") {
                showToast(`💬 ${msg.sender.name}: ${msg.content.slice(0, 48)}`);
              }
            }

            if (msg.targetType === "dm") {
              setData((prev) => {
                if (!prev) return prev;
                const exists = prev.dms.some((d) => d.id === msg.targetId);
                if (!exists) {
                  // Someone new messaged us! Reload workspace DMs silently
                  fetchBootstrap()
                    .then((fresh) =>
                      setData({
                        currentUser: fresh.currentUser,
                        availableUsers: fresh.availableUsers,
                        dms: fresh.dms,
                        contacts: fresh.contacts,
                        servers: fresh.servers,
                      })
                    )
                    .catch(() => {});
                  return prev;
                }

                const updatedDms = prev.dms
                  .map((d) => {
                    if (d.id !== msg.targetId) return d;
                    const incUnread =
                      !isCurrentChat && msg.senderId !== prev.currentUser.id
                        ? d.unreadCount + 1
                        : 0;
                    return {
                      ...d,
                      lastMessage: msg,
                      unreadCount: incUnread,
                      updatedAt: msg.createdAt,
                    };
                  })
                  .sort((a, b) => {
                    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                    return (
                      new Date(b.updatedAt).getTime() -
                      new Date(a.updatedAt).getTime()
                    );
                  });

                return { ...prev, dms: updatedDms };
              });
            }
            break;
          }

          case "message:updated": {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === parsed.message.id ? parsed.message : m
              )
            );
            break;
          }

          case "message:deleted": {
            setMessages((prev) =>
              prev.filter((m) => m.id !== parsed.messageId)
            );
            break;
          }

          case "message:reaction": {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === parsed.messageId
                  ? { ...m, reactions: parsed.reactions }
                  : m
              )
            );
            if (parsed.added && me && parsed.actorId !== me.id) {
              playReactionSparkle(soundEnabledRef.current);
              setBurstState((prev) => ({
                ...prev,
                [parsed.messageId]: {
                  emoji: parsed.emoji,
                  seq: (prev[parsed.messageId]?.seq ?? 0) + 1,
                },
              }));
            }
            break;
          }

          case "typing:update": {
            const key = `${parsed.targetType}:${parsed.targetId}`;
            setTypingByTarget((prev) => {
              const curr = prev[key] ?? [];
              const without = curr.filter((n) => n !== parsed.user.name);
              const next = parsed.isTyping
                ? [...without, parsed.user.name]
                : without;
              return { ...prev, [key]: next };
            });

            if (parsed.isTyping) {
              setTimeout(() => {
                setTypingByTarget((prev) => {
                  const curr = prev[key] ?? [];
                  return {
                    ...prev,
                    [key]: curr.filter((n) => n !== parsed.user.name),
                  };
                });
              }, 3500);
            }
            break;
          }

          case "dm:read": {
            if (
              activeTarget?.type === "dm" &&
              activeTarget.id === parsed.conversationId
            ) {
              setMessages((prev) =>
                prev.map((m) =>
                  parsed.messageIds.includes(m.id) &&
                  !m.readBy.includes(parsed.userId)
                    ? { ...m, readBy: [...m.readBy, parsed.userId] }
                    : m
                )
              );
            }
            break;
          }

          case "presence:update": {
            const u = parsed.user;
            setData((prev) => {
              if (!prev) return prev;
              const patchUser = (item: User) => (item.id === u.id ? u : item);
              return {
                ...prev,
                currentUser:
                  prev.currentUser.id === u.id ? u : prev.currentUser,
                availableUsers: prev.availableUsers.some((x) => x.id === u.id)
                  ? prev.availableUsers.map(patchUser)
                  : !u.isPlaceholder && !u.isBot
                  ? [...prev.availableUsers, u]
                  : prev.availableUsers,
                contacts: prev.contacts.map((c) =>
                  c.contactUserId === u.id ? { ...c, user: u } : c
                ),
                dms: prev.dms.map((d) => ({
                  ...d,
                  peer: d.peer && d.peer.id === u.id ? u : d.peer,
                  participants: d.participants.map(patchUser),
                })),
                servers: prev.servers.map((s) => ({
                  ...s,
                  members: s.members.map((m) =>
                    m.userId === u.id ? { ...m, user: u } : m
                  ),
                })),
              };
            });
            break;
          }

          case "server:created": {
            setData((prev) => {
              if (!prev) return prev;
              if (prev.servers.some((s) => s.id === parsed.server.id)) {
                return prev;
              }
              return { ...prev, servers: [...prev.servers, parsed.server] };
            });
            break;
          }

          case "channel:created": {
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                servers: prev.servers.map((s) =>
                  s.id === parsed.serverId &&
                  !s.channels.some((c) => c.id === parsed.channel.id)
                    ? { ...s, channels: [...s.channels, parsed.channel] }
                    : s
                ),
              };
            });
            break;
          }

          case "voice:update": {
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                servers: prev.servers.map((s) =>
                  s.id === parsed.serverId
                    ? { ...s, voiceParticipants: parsed.voiceParticipants }
                    : s
                ),
              };
            });
            break;
          }
        }
      } catch {
        // Ignore malformed frame
      }
    };

    return () => {
      es.close();
    };
  }, [data?.currentUser.id, showToast]);

  // Visibility-gated lightweight delta sync for Netlify serverless multi-device live chat
  useEffect(() => {
    if (!serverlessPoll || !data?.currentUser.id) return;

    let tick = 0;
    const interval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      tick++;
      const activeTarget = selectedTargetRef.current;
      const me = currentUserRef.current;

      if (activeTarget) {
        fetchMessages(activeTarget.type, activeTarget.id)
          .then((res) => {
            setMessages((prev) => {
              const prevIds = new Set(prev.map((m) => m.id));
              const brandNewFromOthers = res.messages.filter(
                (m) => !prevIds.has(m.id) && me && m.senderId !== me.id
              );
              if (brandNewFromOthers.length > 0) {
                playIncomingChime(soundEnabledRef.current);
                if (activeTarget.type === "dm") {
                  markDmReadApi(activeTarget.id).catch(() => {});
                }
              }
              return res.messages;
            });
          })
          .catch(() => {});
      }

      if (tick % 2 === 0) {
        fetchBootstrap()
          .then((fresh) => {
            setData({
              currentUser: fresh.currentUser,
              availableUsers: fresh.availableUsers,
              dms: fresh.dms,
              contacts: fresh.contacts,
              servers: fresh.servers,
            });
          })
          .catch(() => {});
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [serverlessPoll, data?.currentUser.id]);

  const activeServer = useMemo(() => {
    if (!data || activeArea === "dms") return null;
    return data.servers.find((s) => s.id === activeArea) ?? null;
  }, [data, activeArea]);

  const activeDm = useMemo(() => {
    if (!data || selectedTarget?.type !== "dm") return null;
    return data.dms.find((d) => d.id === selectedTarget.id) ?? null;
  }, [data, selectedTarget]);

  const activeChannel = useMemo(() => {
    if (!activeServer || selectedTarget?.type !== "channel") return null;
    return (
      activeServer.channels.find((c) => c.id === selectedTarget.id) ?? null
    );
  }, [activeServer, selectedTarget]);

  const totalUnreadDms = useMemo(() => {
    if (!data) return 0;
    return data.dms.reduce((acc, d) => acc + d.unreadCount, 0);
  }, [data]);

  const activeTypingNames = useMemo(() => {
    if (!selectedTarget || !data) return [];
    const key = `${selectedTarget.type}:${selectedTarget.id}`;
    return (typingByTarget[key] ?? []).filter(
      (n) => n !== data.currentUser.name
    );
  }, [selectedTarget, typingByTarget, data]);

  const handleSelectArea = (area: "dms" | string) => {
    setActiveArea(area);
    if (!data) return;
    if (area === "dms") {
      if (data.dms.length > 0) {
        setSelectedTarget({ type: "dm", id: data.dms[0].id });
      }
    } else {
      const srv = data.servers.find((s) => s.id === area);
      const firstText = srv?.channels.find((c) => c.type !== "voice");
      if (firstText) {
        setSelectedTarget({ type: "channel", id: firstText.id });
      }
    }
  };

  const handleSelectTarget = (type: TargetType, id: string) => {
    setSelectedTarget({ type, id });
    setMobileChatOpen(true);
  };

  const handleSendMessage = async (params: {
    content: string;
    type?: MessageType;
    replyToId?: string | null;
    metadata?: MessageMetadata | null;
  }) => {
    if (!selectedTarget) return;
    playSendPop(soundEnabled);
    const { message } = await sendMessageApi({
      targetType: selectedTarget.type,
      targetId: selectedTarget.id,
      content: params.content,
      type: params.type,
      replyToId: params.replyToId,
      metadata: params.metadata,
    });
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message]
    );
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    playReactionSparkle(soundEnabled);
    const { reactions } = await toggleReactionApi(messageId, emoji);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
    );
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    const { message } = await editMessageApi(messageId, content);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? message : m))
    );
  };

  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessageApi(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const handleContactCreated = (payload: {
    contact: Contact;
    dm: DmConversation;
    initialSentMessage: Message | null;
  }) => {
    setData((prev) => {
      if (!prev) return prev;
      const otherContacts = prev.contacts.filter(
        (c) => c.id !== payload.contact.id
      );
      const otherDms = prev.dms.filter((d) => d.id !== payload.dm.id);
      return {
        ...prev,
        contacts: [payload.contact, ...otherContacts],
        dms: [payload.dm, ...otherDms],
      };
    });
    setActiveArea("dms");
    setSelectedTarget({ type: "dm", id: payload.dm.id });
    setMobileChatOpen(true);
    showToast(`✅ Chat directo abierto con ${payload.contact.alias}`);
  };

  const handleStartDmWithUser = async (targetUser: User, alias?: string) => {
    if (!data) return;
    const existingDm = data.dms.find((d) => d.peer?.id === targetUser.id);
    if (existingDm) {
      setActiveArea("dms");
      setSelectedTarget({ type: "dm", id: existingDm.id });
      setMobileChatOpen(true);
      return;
    }
    const res = await addContactApi({
      targetUserId: targetUser.id,
      alias: alias || targetUser.name,
      phone: targetUser.phone || undefined,
      email: targetUser.email || undefined,
    });
    handleContactCreated(res);
  };

  const handleServerCreated = (srv: Server) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            servers: prev.servers.some((s) => s.id === srv.id)
              ? prev.servers
              : [...prev.servers, srv],
          }
        : prev
    );
    setActiveArea(srv.id);
    const firstCh = srv.channels.find((c) => c.type !== "voice");
    if (firstCh) {
      setSelectedTarget({ type: "channel", id: firstCh.id });
      setMobileChatOpen(true);
    }
    showToast(`🎉 Servidor "${srv.name}" creado`);
  };

  const handleChannelCreated = (serverId: string, channel: Channel) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            servers: prev.servers.map((s) =>
              s.id === serverId &&
              !s.channels.some((c) => c.id === channel.id)
                ? { ...s, channels: [...s.channels, channel] }
                : s
            ),
          }
        : prev
    );
    if (channel.type !== "voice") {
      setSelectedTarget({ type: "channel", id: channel.id });
      setMobileChatOpen(true);
    }
  };

  const logout = () => {
    clearStoredToken();
    setAuthModalOpen(false);
    setData(null);
    setMessages([]);
    setSelectedTarget(null);
    setNeedsLogin(true);
  };

  if (needsLogin) {
    return (
      <LoginScreen
        onLoggedIn={async () => {
          await loadWorkspace(false);
          setNeedsLogin(false);
          setBootError(null);
        }}
      />
    );
  }

  if (!data) {
    return (
      <div className="h-full w-full bg-[#0b0d14] flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{
            scale: [0.92, 1.08, 0.92],
            rotate: [0, 8, -8, 0],
          }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl shadow-2xl shadow-indigo-500/40"
        >
          💬
        </motion.div>
        <div className="text-sm font-semibold text-slate-300 tracking-wide">
          {bootError ?? "Cargando Comunicate..."}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex overflow-hidden relative bg-[#0b0d14]">
      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94 }}
            className="fixed top-3.5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#181d33]/95 backdrop-blur-xl border border-indigo-400/35 shadow-2xl text-xs font-semibold text-white flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Navigation Pane (Rail + Sidebar) */}
      <div
        className={`${
          mobileChatOpen ? "hidden md:flex" : "flex"
        } w-full md:w-auto h-full shrink-0`}
      >
        <ServerRail
          activeArea={activeArea}
          servers={data.servers}
          totalUnreadDms={totalUnreadDms}
          currentUser={data.currentUser}
          onSelectArea={handleSelectArea}
          onOpenAddContact={() => setAddContactOpen(true)}
          onOpenCreateServer={() => setCreateServerOpen(true)}
          onOpenAccountModal={() => setAuthModalOpen(true)}
        />

        <NavigationSidebar
          activeArea={activeArea}
          dms={data.dms}
          contacts={data.contacts}
          activeServer={activeServer}
          selectedTarget={selectedTarget}
          currentUser={data.currentUser}
          typingByTarget={typingByTarget}
          onSelectTarget={handleSelectTarget}
          onOpenAddContact={() => setAddContactOpen(true)}
          onOpenCreateChannel={(srvId) => setCreateChannelServerId(srvId)}
          onJoinOrLeaveVoice={async (srvId, chId, muted, speaking) => {
            const res = await updateVoiceApi(srvId, {
              channelId: chId,
              muted,
              speaking,
            });
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    servers: prev.servers.map((s) =>
                      s.id === srvId
                        ? { ...s, voiceParticipants: res.voiceParticipants }
                        : s
                    ),
                  }
                : prev
            );
          }}
          onStartDmWithContact={(c) => handleStartDmWithUser(c.user, c.alias)}
          onChangeStatus={async (st: PresenceStatus) => {
            const { user } = await updateMyStatus({ status: st });
            setData((prev) => (prev ? { ...prev, currentUser: user } : prev));
          }}
          onOpenAccountModal={() => setAuthModalOpen(true)}
        />
      </div>

      {/* Main Chat Stage + Right Details Drawer */}
      <div
        className={`${
          mobileChatOpen ? "flex" : "hidden md:flex"
        } flex-1 h-full min-w-0`}
      >
        <ChatStage
          targetType={selectedTarget?.type ?? "dm"}
          activeDm={activeDm}
          activeServer={activeServer}
          activeChannel={activeChannel}
          messages={messages}
          currentUser={data.currentUser}
          typingNames={activeTypingNames}
          burstState={burstState}
          soundEnabled={soundEnabled}
          detailsOpen={detailsOpen}
          onToggleSound={() => setSoundEnabled((s) => !s)}
          onToggleDetails={() => setDetailsOpen((d) => !d)}
          onMobileBack={() => setMobileChatOpen(false)}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onToggleReaction={handleToggleReaction}
          onTypingChange={(isTyping) => {
            if (!selectedTarget) return;
            sendTypingApi(selectedTarget.type, selectedTarget.id, isTyping);
          }}
          onStartCall={(mode) => {
            if (activeDm?.peer) {
              setCallState({ peer: activeDm.peer, mode });
            }
          }}
          onOpenAddContact={() => setAddContactOpen(true)}
        />

        <RightDetailsDrawer
          open={detailsOpen}
          targetType={selectedTarget?.type ?? "dm"}
          activeDm={activeDm}
          activeServer={activeServer}
          currentUser={data.currentUser}
          onClose={() => setDetailsOpen(false)}
          onMessageMember={(u) => handleStartDmWithUser(u)}
        />
      </div>

      {/* Modals */}
      <AddContactModal
        open={addContactOpen}
        onClose={() => setAddContactOpen(false)}
        onCreated={handleContactCreated}
      />

      <AuthAccountModal
        open={authModalOpen}
        currentUser={data.currentUser}
        onClose={() => setAuthModalOpen(false)}
        onLogout={logout}
      />

      <CreateServerModal
        open={createServerOpen}
        onClose={() => setCreateServerOpen(false)}
        onCreated={handleServerCreated}
      />

      <CreateChannelModal
        serverId={createChannelServerId}
        onClose={() => setCreateChannelServerId(null)}
        onCreated={handleChannelCreated}
      />

      <CallOverlayModal
        callState={callState}
        onClose={() => setCallState(null)}
      />
    </div>
  );
}
