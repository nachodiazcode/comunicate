"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Crown,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import type { DmConversation, Server, TargetType, User } from "@/types/chat";
import { UserAvatar } from "./UserAvatar";
import {
  buildInviteMessageText,
  buildWhatsAppInviteUrl,
} from "@/lib/client/invite";

interface RightDetailsDrawerProps {
  open: boolean;
  targetType: TargetType;
  activeDm: DmConversation | null;
  activeServer: Server | null;
  currentUser: User;
  onClose: () => void;
  onMessageMember: (memberUser: User) => void;
}

export function RightDetailsDrawer({
  open,
  targetType,
  activeDm,
  activeServer,
  currentUser,
  onClose,
  onMessageMember,
}: RightDetailsDrawerProps) {
  const peer = activeDm?.peer ?? null;
  const [copiedInvite, setCopiedInvite] = useState(false);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="hidden lg:flex flex-col shrink-0 h-full bg-[#101320] border-l border-white/[0.06] overflow-hidden"
        >
          <div className="w-[280px] h-full flex flex-col">
            <div className="h-[62px] px-4 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {targetType === "dm" ? "Perfil de Contacto" : "Miembros"}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {targetType === "dm" && peer ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-[#161b2e] border border-white/[0.08] p-4 flex flex-col items-center text-center">
                  <div
                    className={`absolute inset-x-0 top-0 h-16 bg-gradient-to-r ${peer.avatarColor} opacity-35`}
                  />
                  <div className="relative mt-4">
                    <UserAvatar user={peer} size="xl" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-white">
                    {activeDm?.contactAlias || peer.name}
                  </h3>
                  <p className="text-xs text-indigo-300">{peer.handle}</p>
                  {peer.customStatus && (
                    <p className="mt-1.5 text-[11px] text-slate-300 bg-white/[0.05] px-2.5 py-1 rounded-full">
                      {peer.customStatus}
                    </p>
                  )}
                </div>

                {/* Contact Channels: Phone & Email + WhatsApp Invite */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Vías de Contacto Directo
                  </div>
                  {peer.phone && (
                    <>
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-emerald-300/80">
                            Teléfono (estilo WhatsApp)
                          </div>
                          <div className="text-xs font-semibold text-white truncate">
                            {peer.phone}
                          </div>
                        </div>
                      </div>

                      <a
                        href={buildWhatsAppInviteUrl({
                          name: activeDm?.contactAlias || peer.name,
                          phone: peer.phone,
                          email: peer.email,
                          fromName: currentUser.name,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
                      >
                        <span>📲 Enviar invitación por WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </>
                  )}
                  {peer.email && (
                    <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-400/20 flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-sky-300/80">
                          Correo Electrónico
                        </div>
                        <div className="text-xs font-semibold text-white truncate">
                          {peer.email}
                        </div>
                      </div>
                    </div>
                  )}

                  {(peer.phone || peer.email) && (
                    <button
                      onClick={() => {
                        const txt = buildInviteMessageText({
                          name: activeDm?.contactAlias || peer.name,
                          phone: peer.phone,
                          email: peer.email,
                          fromName: currentUser.name,
                        });
                        navigator.clipboard?.writeText(txt).catch(() => {});
                        setCopiedInvite(true);
                        setTimeout(() => setCopiedInvite(false), 2000);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      {copiedInvite ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>¡Texto de invitación copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-indigo-300" />
                          <span>Copiar mensaje + link de invitación</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {peer.bio && (
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Acerca de
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {peer.bio}
                    </p>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 space-y-1.5">
                  <div className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Interacciones Activas
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-1">
                    <li>• Desliza un mensaje para responder</li>
                    <li>• Pasa el cursor para reaccionar con partículas</li>
                    <li>• Toca el micrófono para enviar notas de voz</li>
                  </ul>
                </div>
              </div>
            ) : activeServer ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeServer.description}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Miembros — {activeServer.members.length}
                  </div>
                  {activeServer.members.map((m) => (
                    <div
                      key={m.userId}
                      className="p-2 rounded-xl hover:bg-white/[0.05] flex items-center justify-between gap-2 group transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar user={m.user} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span
                              className="text-xs font-semibold truncate"
                              style={{ color: m.roleColor }}
                            >
                              {m.user.name}
                            </span>
                            {m.role === "owner" && (
                              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                            )}
                            {m.role === "admin" && (
                              <Shield className="w-3 h-3 text-indigo-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {m.user.customStatus || m.user.handle}
                          </div>
                        </div>
                      </div>

                      {m.userId !== currentUser.id && (
                        <button
                          onClick={() => onMessageMember(m.user)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 transition cursor-pointer"
                          title={`Enviar DM a ${m.user.name}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
