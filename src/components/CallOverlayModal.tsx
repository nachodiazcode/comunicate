"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import type { User } from "@/types/chat";
import { UserAvatar } from "./UserAvatar";

interface CallOverlayModalProps {
  callState: { peer: User; mode: "audio" | "video" } | null;
  onClose: () => void;
}

export function CallOverlayModal({ callState, onClose }: CallOverlayModalProps) {
  return (
    <AnimatePresence>
      {callState && (
        <CallSessionDialog
          key={`${callState.peer.id}-${callState.mode}`}
          callState={callState}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function CallSessionDialog({
  callState,
  onClose,
}: {
  callState: { peer: User; mode: "audio" | "video" };
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(callState.mode === "video");

  useEffect(() => {
    const connectTimer = setTimeout(() => setConnected(true), 1200);
    const ticker = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => {
      clearTimeout(connectTimer);
      clearInterval(ticker);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.88, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="w-full max-w-sm rounded-[32px] bg-gradient-to-b from-[#1a1f36] to-[#0e111d] border border-white/15 p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden"
      >
        <div
          className={`absolute -top-20 w-64 h-64 rounded-full bg-gradient-to-br ${callState.peer.avatarColor} opacity-20 blur-3xl pointer-events-none`}
        />

        <div className="relative my-4">
          <motion.span
            animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -inset-3 rounded-full border-2 border-indigo-400/50"
          />
          <UserAvatar
            user={callState.peer}
            size="xl"
            showStatus={false}
            speaking={connected}
          />
        </div>

        <h3 className="mt-3 text-lg font-bold text-white">
          {callState.peer.name}
        </h3>
        <p className="text-xs text-indigo-300 mt-1">
          {connected
            ? `En llamada · 0:${String(seconds).padStart(2, "0")}`
            : "Llamando con audio HD..."}
        </p>
        {callState.peer.phone && (
          <p className="text-[11px] text-slate-400 mt-1">
            {callState.peer.phone}
          </p>
        )}

        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => setMuted((m) => !m)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer ${
              muted
                ? "bg-amber-500/25 text-amber-300 border border-amber-400/40"
                : "bg-white/10 hover:bg-white/15 text-white"
            }`}
          >
            {muted ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => setCamOn((c) => !c)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer ${
              camOn
                ? "bg-indigo-500/30 text-indigo-200 border border-indigo-400/40"
                : "bg-white/10 hover:bg-white/15 text-white"
            }`}
          >
            {camOn ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </button>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/40 cursor-pointer"
          >
            <PhoneOff className="w-6 h-6" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
