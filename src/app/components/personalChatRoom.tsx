"use client";

import { supabaseBrowserClient } from "@utils/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@*/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { Badge } from "@*/components/ui/badge";
import { Send, Smile, History, MessageCircle, X } from "lucide-react";
import CryptoJS from "crypto-js";
import { useSearchParams } from "next/navigation";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: ["😀", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "😢", "😭", "😤", "😴", "🤗", "😇", "🙃", "😏", "😌", "😔"],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "👊", "✊", "💪", "🫶", "🙏", "🤲", "👋", "🖖", "🤙"],
  },
  {
    label: "Objects",
    emojis: ["❤️", "💔", "🔥", "⭐", "✨", "💯", "🎉", "🎊", "💡", "🎯", "🧠", "👀", "💀", "🎁", "🏆", "🚀", "💎", "🔮"],
  },
  {
    label: "Symbols",
    emojis: ["✅", "❌", "💚", "💙", "💜", "🖤", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚪", "🟤", "♻️", "🛑"],
  },
];

export const PersonalChatRoomPage = () => {
  const [uniqueUsers, setUniqueUsers] = useState<any[]>([]);
  const [sortedUsers, setSortedUsers] = useState<any[]>([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageData, setMessageData] = useState<any[]>([]);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessageMap, setLastMessageMap] = useState<Record<string, { time: string; preview: string }>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("recentEmojis");
      if (stored) setRecentEmojis(JSON.parse(stored));
    } catch {}
  }, []);

  const secretKey = "key";
  const searchParams = useSearchParams();
  const encryptedRoomId = searchParams.get("roomId");
  const encryptedUserId = searchParams.get("userId");

  const [roomId, setRoomId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (encryptedRoomId && encryptedUserId) {
      try {
        const decryptedRoomIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomId), secretKey
        );
        const decryptedUserIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedUserId), secretKey
        );
        const decryptedRoomId = parseInt(
          decryptedRoomIdBytes.toString(CryptoJS.enc.Utf8), 10
        );
        const decryptedUserId = parseInt(
          decryptedUserIdBytes.toString(CryptoJS.enc.Utf8), 10
        );
        if (isNaN(decryptedRoomId) || isNaN(decryptedUserId)) {
          throw new Error("Decryption resulted in invalid numbers");
        }
        setRoomId(decryptedRoomId);
        setUserId(decryptedUserId);
      } catch (e) {
        console.error("Decryption error:", e);
        setError("Decryption error occurred");
      }
    }
  }, [encryptedRoomId, encryptedUserId]);

  useEffect(() => {
    const fetchMessagesData = async () => {
      if (roomId) {
        const { data, error } = await supabaseBrowserClient
          .from("messages")
          .select("*,user_id(id,user_name,profile_pic)")
          .eq("room_id", roomId);
        if (error) {
          console.error("Error fetching messages:", error);
        } else {
          const filteredMessages = Array.from(
            new Map(data.map((item) => [item.user_id.id, item])).values()
          );
          setUniqueUsers(filteredMessages || []);
        }
      }
    };
    fetchMessagesData();
    const messageSubscription = supabaseBrowserClient
      .channel(`room1:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => { fetchMessagesData(); }
      )
      .subscribe();
    return () => {
      supabaseBrowserClient.removeChannel(messageSubscription);
    };
  }, [roomId]);

  // Fetch last DM timestamp per user + DM preview
  useEffect(() => {
    const fetchLastDMs = async () => {
      if (!roomId || !userId) return;
      const { data, error } = await supabaseBrowserClient
        .from("personal_messages")
        .select("from_id, to_id, message, sent_at")
        .eq("room_id", roomId)
        .or(`from_id.eq.${userId},to_id.eq.${userId}`)
        .order("sent_at", { ascending: false });
      if (error) {
        console.error("Error fetching last DMs:", error.message);
        return;
      }
      const lastMap: Record<string, { time: string; preview: string }> = {};
      for (const msg of data || []) {
        const otherId = msg.from_id === userId ? msg.to_id : msg.from_id;
        if (!lastMap[otherId]) {
          lastMap[otherId] = { time: msg.sent_at, preview: msg.message };
        }
      }
      setLastMessageMap(lastMap as any);
    };
    fetchLastDMs();
    const sub = supabaseBrowserClient
      .channel(`lastdm:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "personal_messages" },
        () => { fetchLastDMs(); }
      )
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [roomId, userId]);

  // Sort users: most recent DM at the bottom, no-DM users at the top
  useEffect(() => {
    const sorted = [...uniqueUsers].sort((a, b) => {
      const aId = a.user_id.id;
      const bId = b.user_id.id;
      const aTime = lastMessageMap[aId]?.time;
      const bTime = lastMessageMap[bId]?.time;
      if (!aTime && !bTime) return 0;
      if (!aTime) return -1;
      if (!bTime) return 1;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
    setSortedUsers(sorted);
  }, [uniqueUsers, lastMessageMap]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageData]);

  const handleClick = (id: any) => {
    setActiveUserId((prev) => (prev === id ? null : id));
    setNewMessage("");
    setShowEmojiPicker(false);
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));
  };

  useEffect(() => {
    const fetchPersonalMessages = async () => {
      if (userId && activeUserId) {
        const { data, error } = await supabaseBrowserClient
          .from("personal_messages")
          .select("*")
          .or(
            `and(from_id.eq.${userId},to_id.eq.${activeUserId}),and(from_id.eq.${activeUserId},to_id.eq.${userId})`
          )
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });
        if (error) {
          console.error("Error fetching data:", error.message);
        } else {
          setMessageData(data);
        }
      }
    };
    fetchPersonalMessages();
    const messageSubscription = supabaseBrowserClient
      .channel(`room4:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "personal_messages" },
        (payload: any) => {
          fetchPersonalMessages();
          if (payload.new && payload.new.from_id !== userId && payload.new.from_id !== activeUserId) {
            setUnreadCounts((prev) => ({
              ...prev,
              [payload.new.from_id]: (prev[payload.new.from_id] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();
    return () => {
      messageSubscription.unsubscribe();
    };
  }, [activeUserId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSend = (toId: any) => {
    if (!newMessage.trim()) return;
    const text = newMessage;
    const optId = `dm-opt-${Date.now()}`;
    setNewMessage("");
    setShowEmojiPicker(false);
    setOptimisticIds((prev) => new Set(prev).add(optId));

    setMessageData((prev) => [...prev, {
      id: optId,
      _optimistic: true,
      room_id: roomId,
      from_id: userId,
      to_id: toId,
      message: text,
      sent_at: new Date().toISOString(),
    }]);

    setLastMessageMap((prev) => ({
      ...prev,
      [toId]: { time: new Date().toISOString(), preview: text },
    }));

    handleUserDetails(roomId, userId, toId, text);
    setOptimisticIds((prev) => {
      const next = new Set(prev);
      next.delete(optId);
      return next;
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 12);
      try { localStorage.setItem("recentEmojis", JSON.stringify(next)); } catch {}
      return next;
    });
    setShowEmojiPicker(false);
  };

  const getBubbleSize = (index: number, total: number) => {
    // Most recent (last item) = largest, older = progressively smaller
    if (total <= 1) return { width: "w-full", avatar: "h-10 w-10", text: "text-sm", preview: true };
    const fromBottom = total - 1 - index; // 0 = most recent
    if (fromBottom === 0) return { width: "w-full", avatar: "h-10 w-10", text: "text-sm", preview: true };
    if (fromBottom === 1) return { width: "w-[calc(100%-24px)]", avatar: "h-9 w-9", text: "text-sm", preview: true };
    if (fromBottom === 2) return { width: "w-[calc(100%-48px)]", avatar: "h-8 w-8", text: "text-xs", preview: false };
    return { width: "w-[calc(100%-72px)]", avatar: "h-7 w-7", text: "text-xs", preview: false };
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground">Chats</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {sortedUsers.filter((u) => lastMessageMap[u.user_id.id]).length} active
          </span>
        </div>
      </div>

      {/* Floating Bubbles */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col justify-end gap-2">
        {sortedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center mb-3">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No members yet</p>
          </div>
        ) : (
          sortedUsers.map((item, index) => {
            const uid = item.user_id.id;
            const isActive = activeUserId === uid;
            const unread = unreadCounts[uid] || 0;
            const isSelf = uid === userId;
            const lastInfo = lastMessageMap[uid];
            const hasHistory = !!lastInfo;
            const size = getBubbleSize(index, sortedUsers.length);

            // When a bubble is expanded, show full chat instead of the bubble card
            if (isActive) {
              return (
                <div
                  key={uid}
                  className="w-full rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden animate-fade-in shadow-lg shadow-black/20"
                >
                  {/* Expanded chat header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 bg-card">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 border border-border/50">
                        <AvatarImage src={item.user_id?.profile_pic} alt={item.user_id?.user_name} className="object-cover" />
                        <AvatarFallback className="text-[9px] bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-300">
                          {getInitials(item.user_id?.user_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium text-foreground leading-tight">{item.user_id?.user_name}</p>
                        <p className="text-[9px] text-muted-foreground">Direct message</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveUserId(null)}
                      className="h-6 w-6 rounded-full hover:bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="max-h-[300px] min-h-[120px] overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                    {messageData && messageData.length > 0 ? (
                      messageData.map((message: any) => {
                        const isMine = message.from_id === userId;
                        const isOpt = message._optimistic;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`px-3 py-1.5 rounded-2xl text-sm max-w-[85%] break-words ${
                                isMine
                                  ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-md"
                                  : "bg-secondary/70 text-foreground rounded-bl-md"
                              } ${isOpt ? "opacity-70" : ""}`}
                            >
                              <p className="leading-relaxed">{message.message}</p>
                              <p className={`text-[10px] mt-0.5 ${isMine ? "text-white/50" : "text-muted-foreground"}`}>
                                {formatTime(message.sent_at)}
                                {isOpt && " · sending..."}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No messages yet. Say hi!</p>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-border/30 p-2 flex items-center gap-1.5">
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`shrink-0 h-8 w-8 rounded-lg transition-all flex items-center justify-center ${
                          showEmojiPicker
                            ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                            : "bg-secondary/30 hover:bg-secondary/50 text-muted-foreground"
                        }`}
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </button>
                      {showEmojiPicker && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute bottom-full mb-2 left-0 w-[260px] bg-card border border-border/50 rounded-xl shadow-2xl shadow-black/30 animate-fade-in z-20 overflow-hidden"
                        >
                          {recentEmojis.length > 0 && (
                            <div className="px-2 pt-2 pb-1.5 border-b border-border/30">
                              <div className="flex items-center gap-1 mb-1">
                                <History className="h-2.5 w-2.5 text-muted-foreground" />
                                <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {recentEmojis.slice(0, 8).map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleEmojiSelect(emoji)}
                                    className="h-6 w-6 flex items-center justify-center hover:bg-secondary rounded-md text-sm transition-all hover:scale-110"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-1 px-2 pt-1.5 pb-1 border-b border-border/30">
                            {EMOJI_CATEGORIES.map((cat, i) => (
                              <button
                                key={cat.label}
                                onClick={() => setEmojiTab(i)}
                                className={`text-[8px] font-medium px-1.5 py-0.5 rounded-lg transition-all ${
                                  emojiTab === i
                                    ? "bg-purple-500/15 text-purple-400"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                          <div className="p-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-6 gap-0.5">
                              {EMOJI_CATEGORIES[emojiTab].emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleEmojiSelect(emoji)}
                                  className="h-7 w-7 flex items-center justify-center hover:bg-secondary/80 rounded-lg text-base transition-all hover:scale-110 active:scale-95"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSend(item.user_id?.id);
                        }
                      }}
                      placeholder="Message..."
                      className="flex-1 bg-secondary/30 border-border/30 h-8 rounded-lg text-xs"
                    />
                    <button
                      onClick={() => handleSend(item.user_id?.id)}
                      disabled={!newMessage.trim()}
                      className="shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white disabled:opacity-30 transition-all hover:from-purple-500 hover:to-blue-500"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            }

            // Floating bubble card (collapsed state)
            return (
              <button
                key={uid}
                onClick={() => handleClick(uid)}
                className={`${size.width} flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left cursor-pointer border ${
                  unread > 0
                    ? "border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10"
                    : "border-border/40 bg-card/40 hover:bg-card/70 backdrop-blur-sm"
                } shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}
              >
                <div className="relative shrink-0">
                  <Avatar className={`${size.avatar} border-2 ${unread > 0 ? "border-purple-500/40" : "border-border/50"}`}>
                    <AvatarImage
                      src={item.user_id?.profile_pic}
                      alt={item.user_id?.user_name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-[10px] bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-300">
                      {getInitials(item.user_id?.user_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  {hasHistory && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background" />
                  )}
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-purple-600 text-[8px] font-bold text-white flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`${size.text} font-medium text-foreground truncate ${unread > 0 ? "font-semibold" : ""}`}>
                      {item.user_id?.user_name}
                      {isSelf && <span className="text-muted-foreground font-normal ml-1">(you)</span>}
                    </p>
                  </div>
                  {size.preview && lastInfo && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {lastInfo.preview}
                    </p>
                  )}
                  {!hasHistory && !isSelf && (
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">Tap to start a chat</p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

async function handleUserDetails(
  roomId: any,
  userId: any,
  id: any,
  newMessage: any
) {
  try {
    const { error } = await supabaseBrowserClient
      .from("personal_messages")
      .insert([
        { room_id: roomId, from_id: userId, to_id: id, message: newMessage },
      ]);
    if (error) {
      console.error("Error sending message:", error.message);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}
