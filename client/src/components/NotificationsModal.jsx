import React from 'react';
import { X, Bell, Megaphone, AtSign, CheckCheck, MessageSquare } from 'lucide-react';

export default function NotificationsModal({
  isOpen,
  onClose,
  notifications = [],
  onMarkAllRead,
  onSelectNotification
}) {
  if (!isOpen) return null;

  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#222529] border border-[#383C40] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383C40] flex items-center justify-between bg-[#1E2124]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            {safeNotifications.length > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-4 max-h-96 overflow-y-auto space-y-2">
          {safeNotifications.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No new notifications.
            </div>
          ) : (
            safeNotifications.map((n) => {
              const isAnnouncement = n.content?.includes('announcement') || n.content?.includes('જાહેરાત');
              const isDM = n.content?.includes('direct message') || n.content?.includes('અંગત') || n.is_direct;
              const isUnread = !n.is_read;

              return (
                <div
                  key={n.id}
                  onClick={() => onSelectNotification(n)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isUnread
                      ? 'bg-[#1164A3]/15 border-blue-500/40 hover:bg-[#1164A3]/25 shadow-sm'
                      : 'bg-[#1A1D21] border-[#2C3136] hover:bg-[#25292D]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isAnnouncement
                          ? 'bg-amber-500/20 text-amber-400'
                          : isDM
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {isAnnouncement ? (
                        <Megaphone className="w-4 h-4" />
                      ) : isDM ? (
                        <MessageSquare className="w-4 h-4" />
                      ) : (
                        <AtSign className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-200 font-medium leading-relaxed">
                        {n.content}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                        <span>{isDM ? 'Direct Message' : `#${n.channel_name}`}</span>
                        <span>
                          {new Date(n.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#383C40] bg-[#1E2124] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2C3136] hover:bg-[#383C40] text-gray-300 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
