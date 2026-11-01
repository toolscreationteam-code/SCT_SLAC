import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Lenis from 'lenis';
import confetti from 'canvas-confetti';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CreateChannelModal from './components/CreateChannelModal';
import EditChannelModal from './components/EditChannelModal';
import ChannelMembersModal from './components/ChannelMembersModal';
import NotificationsModal from './components/NotificationsModal';
import UserManagementModal from './components/UserManagementModal';
import { DEFAULT_MEMBERS } from './constants/members';

export default function App() {
  // 1. Session check with 20-day expiration
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('sct_slack_current_user');
      const expiresAt = localStorage.getItem('sct_slack_session_expires');

      if (!savedUser) return null;

      if (expiresAt && Date.now() > Number(expiresAt)) {
        localStorage.removeItem('sct_slack_current_user');
        localStorage.removeItem('sct_slack_session_expires');
        return null;
      }

      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [channelMembers, setChannelMembers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({}); // { [channelId]: number }
  const [notifications, setNotifications] = useState([]);
  const [typingUser, setTypingUser] = useState(null);

  // Modals
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isEditChannelOpen, setIsEditChannelOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeChannelRef = useRef(activeChannel);
  const channelMembersRef = useRef(channelMembers);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  useEffect(() => {
    channelMembersRef.current = channelMembers;
  }, [channelMembers]);

  // Smooth momentum scroll with Lenis (prevent on modal dialogs and scrollable lists)
  useEffect(() => {
    const lenis = new Lenis({
      smoothWheel: true,
      duration: 1.0,
      prevent: (node) =>
        Boolean(
          node?.closest &&
          (node.closest('[data-lenis-prevent]') !== null ||
           node.closest('.overflow-y-auto') !== null)
        )
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const reqId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(reqId);
      lenis.destroy();
    };
  }, []);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Mark channel or DM as read in backend
  const markChannelAsRead = async (channelId, messageId = null) => {
    if (!currentUser?.id || !channelId) return;
    try {
      await fetch(`/api/channels/${channelId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          message_id: messageId
        })
      });
    } catch (err) {
      console.error('Failed to mark channel as read:', err);
    }
  };

  // Fetch channels & DMs for current user (with persistent unread counts)
  const fetchChannels = async (userId, preserveActiveId = null) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/channels?userId=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setChannels(data);

        // Load persistent unread counts from database
        const counts = {};
        data.forEach((c) => {
          if (c.unread_count > 0) {
            counts[c.id] = c.unread_count;
            if (c.is_direct && c.dm_user?.id) {
              counts[`user_${c.dm_user.id}`] = c.unread_count;
            }
          }
        });

        let targetChannel = activeChannelRef.current;
        if (preserveActiveId) {
          const match = data.find((c) => c.id === preserveActiveId);
          if (match) targetChannel = match;
        } else if (!targetChannel && data.length > 0) {
          const ann = data.find((c) => c.is_announcement);
          targetChannel = ann || data[0];
        }

        if (targetChannel) {
          setActiveChannel(targetChannel);
          // Active conversation unread count is cleared
          delete counts[targetChannel.id];
          if (targetChannel.is_direct && targetChannel.dm_user?.id) {
            delete counts[`user_${targetChannel.dm_user.id}`];
          }
          markChannelAsRead(targetChannel.id);
        }

        setUnreadCounts(counts);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchUsers();
      fetchChannels(currentUser.id);
      fetchNotifications(currentUser.id);
    }
  }, [currentUser?.id]);

  // Socket.IO Setup
  useEffect(() => {
    if (!currentUser?.id) return;

    const socketUrl = window.location.port === '5173' ? 'http://localhost:5000' : '/';
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('user_connected', currentUser.id);
      if (activeChannelRef.current?.id) {
        socket.emit('join_channel', activeChannelRef.current.id);
      }
    });

    socket.on('online_users', (list) => {
      setOnlineUsers(list);
    });

    // Real-time message listener with active conversation detection
    socket.on('new_message', (msg) => {
      const currentActive = activeChannelRef.current;
      const isViewingCurrent = currentActive?.id === msg.channel_id;

      if (isViewingCurrent) {
        // Active conversation logic: Display message directly, do NOT increment unread count
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.user_id !== currentUser.id) {
          markChannelAsRead(msg.channel_id, msg.id);
        }
      } else {
        // Increment unread badge count for this channel / user
        if (msg.user_id !== currentUser.id) {
          setUnreadCounts((prev) => {
            const updated = {
              ...prev,
              [msg.channel_id]: (prev[msg.channel_id] || 0) + 1
            };
            if (msg.is_direct) {
              updated[`user_${msg.user_id}`] = (prev[`user_${msg.user_id}`] || 0) + 1;
            }
            return updated;
          });

          // If new DM conversation received, refresh channels list
          if (msg.is_direct) {
            fetchChannels(currentUser.id, currentActive?.id);
          }
        }
      }
    });

    // Real-time synchronization of read status across devices
    socket.on('channel_marked_read', ({ channelId }) => {
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[channelId];
        return updated;
      });
    });

    socket.on('message_deleted', ({ channelId, messageId }) => {
      if (activeChannelRef.current?.id === channelId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    });

    socket.on('message_updated', (updatedMsg) => {
      if (activeChannelRef.current?.id === updatedMsg.channel_id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
        );
      }
    });

    socket.on('notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
    });

    socket.on('channel_created', () => {
      fetchChannels(currentUser.id, activeChannelRef.current?.id);
    });

    socket.on('channel_updated', (updatedChannel) => {
      setChannels((prev) =>
        prev.map((c) => (c.id === updatedChannel.id ? { ...c, ...updatedChannel } : c))
      );
      if (activeChannelRef.current?.id === updatedChannel.id) {
        setActiveChannel((prev) => ({ ...prev, ...updatedChannel }));
      }
    });

    socket.on('channel_deleted', ({ channelId }) => {
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      if (activeChannelRef.current?.id === channelId) {
        setActiveChannel(channels[0] || null);
      }
    });

    socket.on('message_reaction_updated', ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    });

    // Real-time WhatsApp-style Double Tick (Read Receipts) update
    socket.on('messages_read', ({ channelId, userId, userName, avatar, userRole, lastReadMessageId, readAt }) => {
      if (activeChannelRef.current?.id === channelId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id <= lastReadMessageId && m.user_id !== userId) {
              const currentReadBy = m.read_by || [];
              const alreadyIn = currentReadBy.some((r) => r.user_id === userId);
              const updatedReadBy = alreadyIn
                ? currentReadBy
                : [
                    ...currentReadBy,
                    {
                      user_id: userId,
                      user_name: userName,
                      avatar,
                      user_role: userRole,
                      read_at: readAt
                    }
                  ];
              const isDirect = activeChannelRef.current?.is_direct;
              const otherCount = isDirect
                ? 1
                : Math.max(1, (channelMembersRef.current?.length || 1) - 1);
              return {
                ...m,
                read_by: updatedReadBy,
                is_read: true,
                is_read_all: updatedReadBy.length >= otherCount
              };
            }
            return m;
          })
        );
      }
    });

    socket.on('member_updated', ({ channelId }) => {
      if (activeChannelRef.current?.id === channelId) {
        fetchChannelMembers(channelId);
      }
      fetchChannels(currentUser.id, activeChannelRef.current?.id);
    });

    socket.on('user_created', () => fetchUsers());
    socket.on('user_updated', () => fetchUsers());
    socket.on('user_deleted', () => fetchUsers());

    socket.on('user_typing', ({ channelId, userName, isTyping }) => {
      if (activeChannelRef.current?.id === channelId && isTyping) {
        setTypingUser(userName);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 2000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser?.id]);

  // On active channel change
  useEffect(() => {
    if (!activeChannel?.id) return;

    // 4. Automatically Clear Unread Count
    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[activeChannel.id];
      if (activeChannel.is_direct && activeChannel.dm_user?.id) {
        delete updated[`user_${activeChannel.dm_user.id}`];
      }
      return updated;
    });

    // Mark as read in database
    markChannelAsRead(activeChannel.id);

    if (socketRef.current?.connected) {
      socketRef.current.emit('join_channel', activeChannel.id);
    }

    fetchMessages(activeChannel.id);
    if (!activeChannel.is_direct) {
      fetchChannelMembers(activeChannel.id);
    } else {
      setChannelMembers([]);
    }
  }, [activeChannel?.id]);

  const fetchMessages = async (channelId) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`);
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const fetchChannelMembers = async (channelId) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/members`);
      const data = await res.json();
      if (Array.isArray(data)) setChannelMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const fetchNotifications = async (userId) => {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  // Handlers
  const handleLoginSuccess = async (user, expiresAt) => {
    localStorage.setItem('sct_slack_current_user', JSON.stringify(user));
    if (expiresAt) {
      localStorage.setItem('sct_slack_session_expires', String(expiresAt));
    }
    setCurrentUser(user);
    await fetchUsers();
    await fetchChannels(user.id);

    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  };

  const handleLogout = () => {
    localStorage.removeItem('sct_slack_current_user');
    localStorage.removeItem('sct_slack_session_expires');
    setCurrentUser(null);
    setActiveChannel(null);
    setMessages([]);
    setUnreadCounts({});
    if (socketRef.current) socketRef.current.disconnect();
  };

  // Start or open Direct Message
  const handleStartDM = async (targetUser) => {
    if (!currentUser?.id || !targetUser?.id) return;
    try {
      // Clear DM unread badge immediately in UI
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[`user_${targetUser.id}`];
        return updated;
      });

      const res = await fetch('/api/dm/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId1: currentUser.id,
          userId2: targetUser.id
        })
      });

      const dmChannel = await res.json();
      if (res.ok) {
        if (!dmChannel.dm_user) {
          dmChannel.dm_user = targetUser;
        }
        await fetchChannels(currentUser.id, dmChannel.id);
        setActiveChannel(dmChannel);
        markChannelAsRead(dmChannel.id);
      }
    } catch (err) {
      console.error('Start DM error:', err);
    }
  };

  const handleSendMessage = async (payload) => {
    if (!activeChannel?.id || !currentUser?.id) return;
    try {
      const res = await fetch(`/api/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          ...payload
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Message sending failed.');
      }
    } catch (err) {
      console.error('Send message failed:', err);
    }
  };

  // Delete message permanently
  const handleDeleteMessage = async (channelId, messageId) => {
    try {
      const res = await fetch(
        `/api/channels/${channelId}/messages/${messageId}?requestedBy=${currentUser.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete message.');
      }
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  // Edit message content
  const handleEditMessage = async (channelId, messageId, newContent) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent,
          requested_by: currentUser.id
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updated : m))
        );
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to edit message.');
      }
    } catch (err) {
      console.error('Edit message error:', err);
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    if (!currentUser?.id || !messageId || !emoji) return;
    try {
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const currentReactions = Array.isArray(m.reactions) ? m.reactions : [];
          const existing = currentReactions.find((r) => r.emoji === emoji);
          const hasReacted = existing && Array.isArray(existing.users) && existing.users.includes(currentUser.id);

          let updated;
          if (hasReacted) {
            updated = currentReactions
              .map((r) => {
                if (r.emoji !== emoji) return r;
                return {
                  ...r,
                  count: r.count - 1,
                  users: r.users.filter((u) => u !== currentUser.id),
                  user_names: r.user_names.filter((n) => n !== currentUser.name)
                };
              })
              .filter((r) => r.count > 0);
          } else if (existing) {
            updated = currentReactions.map((r) => {
              if (r.emoji !== emoji) return r;
              return {
                ...r,
                count: r.count + 1,
                users: [...r.users, currentUser.id],
                user_names: [...r.user_names, currentUser.name]
              };
            });
          } else {
            updated = [
              ...currentReactions,
              {
                emoji,
                count: 1,
                users: [currentUser.id],
                user_names: [currentUser.name]
              }
            ];
          }
          return { ...m, reactions: updated };
        })
      );

      const res = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          emoji
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch (err) {
      console.error('Toggle reaction failed:', err);
    }
  };

  const handleCreateChannel = async (channelData) => {
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelData)
      });
      const newChan = await res.json();
      if (res.ok) {
        setIsCreateChannelOpen(false);
        await fetchChannels(currentUser.id);
        setActiveChannel(newChan);
      } else {
        alert(newChan.error || 'Failed to create channel.');
      }
    } catch (err) {
      console.error('Create channel error:', err);
    }
  };

  // Edit Channel Details
  const handleUpdateChannel = async (channelId, updateData) => {
    try {
      const res = await fetch(`/api/channels/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_by: currentUser.id,
          ...updateData
        })
      });
      const updated = await res.json();
      if (res.ok) {
        setActiveChannel(updated);
        await fetchChannels(currentUser.id, updated.id);
      } else {
        alert(updated.error || 'Failed to update channel.');
      }
    } catch (err) {
      console.error('Update channel error:', err);
    }
  };

  // Delete Channel
  const handleDeleteChannel = async (channelId) => {
    try {
      const res = await fetch(
        `/api/channels/${channelId}?requestedBy=${currentUser.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        await fetchChannels(currentUser.id);
        setActiveChannel(channels[0] || null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete channel.');
      }
    } catch (err) {
      console.error('Delete channel error:', err);
    }
  };

  const handleAddMember = async (userIdToAdd) => {
    if (!activeChannel?.id) return;
    try {
      await fetch(`/api/channels/${activeChannel.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userIdToAdd,
          requested_by: currentUser.id
        })
      });
      fetchChannelMembers(activeChannel.id);
      fetchChannels(currentUser.id, activeChannel.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (userIdToRemove) => {
    if (!activeChannel?.id) return;
    try {
      await fetch(
        `/api/channels/${activeChannel.id}/members/${userIdToRemove}?requestedBy=${currentUser.id}`,
        { method: 'DELETE' }
      );
      fetchChannelMembers(activeChannel.id);
      fetchChannels(currentUser.id, activeChannel.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUser?.id) return;
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  };

  // Notification click: dismisses immediately and jumps to channel
  const handleSelectNotification = async (notif) => {
    // 1. Permanently delete/dismiss from DB & state
    try {
      await fetch(`/api/notifications/${notif.id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    } catch (err) {
      console.error(err);
    }

    // 2. Clear unread count for target channel
    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[notif.channel_id];
      return updated;
    });

    // 3. Switch to target channel or DM
    const targetChan = channels.find((c) => c.id === notif.channel_id);
    if (targetChan) {
      setActiveChannel(targetChan);
    } else {
      await fetchChannels(currentUser.id, notif.channel_id);
    }

    setIsNotificationsOpen(false);
  };

  const safeUsersList = users && users.length > 0 ? users : DEFAULT_MEMBERS;

  if (!currentUser) {
    return <LoginScreen users={safeUsersList} onLoginSuccess={handleLoginSuccess} />;
  }

  const unreadNotifCount = (notifications || []).filter((n) => !n.is_read).length;

  return (
    <div className="flex h-screen bg-[#1A1D21] overflow-hidden select-text">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        channels={channels}
        activeChannel={activeChannel}
        onSelectChannel={setActiveChannel}
        onStartDM={handleStartDM}
        users={safeUsersList}
        onlineUsers={onlineUsers}
        unreadCounts={unreadCounts}
        onOpenCreateChannel={() => setIsCreateChannelOpen(true)}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onLogout={handleLogout}
        unreadNotificationsCount={unreadNotifCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <ChatArea
        currentUser={currentUser}
        activeChannel={activeChannel}
        messages={messages}
        channelMembers={channelMembers}
        onlineUsers={onlineUsers}
        users={safeUsersList}
        onSendMessage={handleSendMessage}
        onDeleteMessage={handleDeleteMessage}
        onEditMessage={handleEditMessage}
        onToggleReaction={handleToggleReaction}
        onOpenMembersModal={() => setIsMembersModalOpen(true)}
        onOpenEditChannel={() => setIsEditChannelOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        typingUser={typingUser}
      />

      {/* Modals */}
      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        onCreate={handleCreateChannel}
        currentUser={currentUser}
        users={safeUsersList}
      />

      <EditChannelModal
        isOpen={isEditChannelOpen}
        onClose={() => setIsEditChannelOpen(false)}
        channel={activeChannel}
        currentUser={currentUser}
        onUpdateChannel={handleUpdateChannel}
        onDeleteChannel={handleDeleteChannel}
      />

      <ChannelMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        channel={activeChannel}
        members={channelMembers}
        allUsers={users}
        currentUser={currentUser}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onSelectNotification={handleSelectNotification}
      />

      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        users={users}
        currentUser={currentUser}
        onRefreshUsers={fetchUsers}
      />
    </div>
  );
}
