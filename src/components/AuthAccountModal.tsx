"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut, X } from "lucide-react";
import type { User } from "@/types/chat";
import { UserAvatar } from "./UserAvatar";

interface AuthAccountModalProps {
  open: boolean;
  currentUser: User;
  onClose: () => void;
  onLogout: () => void;
}

export function AuthAccountModal({
  open,
  currentUser,
  onClose,
  onLogout,
}: AuthAccountModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#131728] border border-white/15 shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Tu cuenta</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <UserAvatar user={currentUser} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {currentUser.phone || currentUser.email || currentUser.handle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
