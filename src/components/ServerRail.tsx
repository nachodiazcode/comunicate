"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Plus, UserPlus, Users, Volume2 } from "lucide-react";
import type { Server, User } from "@/types/chat";
import { UserAvatar } from "./UserAvatar";

interface ServerRailProps {
  activeArea: "dms" | string; // "dms" or serverId
  servers: Server[];
  totalUnreadDms: number;
  currentUser: User;
  onSelectArea: (area: "dms" | string) => void;
  onOpenAddContact: () => void;
  onOpenCreateServer: () => void;
  onOpenAccountModal: () => void;
}

export function ServerRail({
  activeArea,
  servers,
  totalUnreadDms,
  currentUser,
  onSelectArea,
  onOpenAddContact,
  onOpenCreateServer,
  onOpenAccountModal,
}: ServerRailProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <aside className="w-[74px] shrink-0 h-full bg-[#090b11] border-r border-white/[0.06] flex flex-col items-center py-3 gap-2.5 z-30 relative">
      {/* Direct Messages & Contacts Orb (Telegram + Discord Home) */}
      <div
        className="relative flex items-center justify-center w-full"
        onMouseEnter={() => setHoveredId("dms")}
        onMouseLeave={() => setHoveredId(null)}
      >
        {activeArea === "dms" && (
          <motion.div
            layoutId="rail-active-pill"
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="absolute left-0 w-1 h-9 rounded-r-full bg-gradient-to-b from-indigo-400 via-fuchsia-400 to-cyan-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]"
          />
        )}
        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => onSelectArea("dms")}
          className={`relative w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeArea === "dms"
              ? "rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30"
              : "rounded-[24px] hover:rounded-2xl bg-[#161a29] hover:bg-indigo-500/90 text-slate-300 hover:text-white"
          }`}
          aria-label="Mensajes Directos y Contactos"
        >
          <MessageCircle className="w-5 h-5" />
          {totalUnreadDms > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-[11px] font-bold text-white flex items-center justify-center border-2 border-[#090b11] shadow-md"
            >
              {totalUnreadDms > 99 ? "99+" : totalUnreadDms}
            </motion.span>
          )}
        </motion.button>

        <RailTooltip
          visible={hoveredId === "dms"}
          label="Mensajes Directos · Teléfono y Correo"
        />
      </div>

      {/* Quick Add Contact by Phone / Email Shortcut */}
      <div
        className="relative flex items-center justify-center w-full"
        onMouseEnter={() => setHoveredId("add-contact")}
        onMouseLeave={() => setHoveredId(null)}
      >
        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.93 }}
          onClick={onOpenAddContact}
          className="w-11 h-11 rounded-[22px] hover:rounded-2xl bg-emerald-500/12 hover:bg-emerald-500/25 border border-emerald-400/25 text-emerald-400 flex items-center justify-center transition-all cursor-pointer"
          aria-label="Agregar por número o correo"
        >
          <UserPlus className="w-4 h-4" />
        </motion.button>
        <RailTooltip
          visible={hoveredId === "add-contact"}
          label="Agregar número (WhatsApp) o correo"
        />
      </div>

      <div className="w-8 h-[1px] bg-white/[0.08] my-0.5" />

      {/* Servers List */}
      <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-2.5 py-0.5">
        {servers.map((srv) => {
          const isActive = activeArea === srv.id;
          const activeVoiceCount = srv.voiceParticipants.length;

          return (
            <div
              key={srv.id}
              className="relative flex items-center justify-center w-full"
              onMouseEnter={() => setHoveredId(srv.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {isActive ? (
                <motion.div
                  layoutId="rail-active-pill"
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  className="absolute left-0 w-1 h-9 rounded-r-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                />
              ) : hoveredId === srv.id ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 18, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="absolute left-0 w-1 rounded-r-full bg-white/70"
                />
              ) : null}

              <motion.button
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => onSelectArea(srv.id)}
                className={`relative w-12 h-12 flex items-center justify-center text-lg font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? `rounded-2xl bg-gradient-to-br ${srv.gradient} text-white shadow-lg`
                    : "rounded-[24px] hover:rounded-2xl bg-[#161a29] hover:bg-[#1f253b] text-slate-200 border border-white/[0.05]"
                }`}
              >
                <span>{srv.icon}</span>
                {activeVoiceCount > 0 && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-[#090b11] flex items-center justify-center border-2 border-[#090b11] shadow">
                    <Volume2 className="w-2.5 h-2.5 stroke-[2.8]" />
                  </span>
                )}
              </motion.button>

              <RailTooltip
                visible={hoveredId === srv.id}
                label={
                  activeVoiceCount > 0
                    ? `${srv.name} (${activeVoiceCount} en voz)`
                    : srv.name
                }
              />
            </div>
          );
        })}

        {/* Create Server Button */}
        <div
          className="relative flex items-center justify-center w-full"
          onMouseEnter={() => setHoveredId("create-srv")}
          onMouseLeave={() => setHoveredId(null)}
        >
          <motion.button
            whileHover={{ scale: 1.07, rotate: 90 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={onOpenCreateServer}
            className="w-12 h-12 rounded-[24px] hover:rounded-2xl bg-[#161a29] hover:bg-indigo-500/20 border border-dashed border-white/15 hover:border-indigo-400/50 text-indigo-400 flex items-center justify-center cursor-pointer"
            aria-label="Crear Servidor"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
          <RailTooltip
            visible={hoveredId === "create-srv"}
            label="Crear nueva comunidad / servidor"
          />
        </div>
      </div>

      {/* Multi-Account / Current User Switcher */}
      <div
        className="relative flex flex-col items-center gap-1.5 pt-2 border-t border-white/[0.06] w-full"
        onMouseEnter={() => setHoveredId("switch-user")}
        onMouseLeave={() => setHoveredId(null)}
      >
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={onOpenAccountModal}
          className="relative p-0.5 rounded-full hover:ring-2 hover:ring-indigo-400/60 transition cursor-pointer"
          aria-label="Cuenta y cambio multi-usuario"
        >
          <UserAvatar user={currentUser} size="md" showStatus />
          <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center border border-[#090b11]">
            <Users className="w-2.5 h-2.5" />
          </span>
        </motion.button>
        <RailTooltip
          visible={hoveredId === "switch-user"}
          label={`${currentUser.name} · Cambiar o crear cuenta`}
        />
      </div>
    </aside>
  );
}

function RailTooltip({ visible, label }: { visible: boolean; label: string }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -6, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -4, scale: 0.95 }}
          transition={{ duration: 0.14 }}
          className="pointer-events-none absolute left-[78px] z-50 whitespace-nowrap rounded-xl bg-[#0e111b]/95 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white shadow-xl border border-white/10"
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
