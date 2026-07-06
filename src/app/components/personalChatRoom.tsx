"use client";

import { supabaseBrowserClient } from "@utils/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@*/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { Badge } from "@*/components/ui/badge";
import { Send, ChevronDown, MessageSquare, Smile, History } from "lucide-react";
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
  const [activeUserId, setActiveUserId] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageData, setMessageData] = useState<any[]>([]);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground">Direct Messages</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {uniqueUsers.length} {uniqueUsers.length === 1 ? "member" : "members"}
          </span>
        </div>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {uniqueUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="h-12 w-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No members in this room yet</p>
          </div>
        ) : (
          uniqueUsers.map((item) => {
            const isActive = activeUserId === item.user_id.id;
            const unread = unreadCounts[item.user_id.id] || 0;
            return (
              <div key={item.user_id.id} className="animate-fade-in">
                {/* User row */}
                <button
                  onClick={() => handleClick(item.user_id.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative ${
                    isActive
                      ? "bg-purple-500/10 border border-purple-500/20"
                      : "hover:bg-secondary/50 border border-transparent"
                  }`}
                >
                  <Avatar className="h-9 w-9 shrink-0 border border-border/50">
                    <AvatarImage
                      src={item.user_id?.profile_pic}
                      alt={item.user_id?.user_name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-300">
                      {getInitials(item.user_id?.user_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.user_id?.user_name}
                      {item.user_id.id === userId && (
                        <span className="text-xs text-muted-foreground ml-1">(you)</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {unread > 0 && (
                      <Badge className="h-5 min-w-[20px] px-1 text-[10px] bg-purple-600 hover:bg-purple-600">
                        {unread}
                      </Badge>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isActive ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded chat */}
                {isActive && (
                  <div className="mx-1 mt-1 mb-2 rounded-xl border border-border/50 bg-card/50 overflow-hidden animate-fade-in">
                    {/* Messages */}
                    <div className="max-h-[350px] min-h-[80px] overflow-y-auto custom-scrollbar p-3 space-y-1.5">
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
                                className={`px-3 py-1.5 rounded-2xl text-sm max-w-[80%] break-words ${
                                  isMine
                                    ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-md"
                                    : "bg-secondary/70 text-foreground rounded-bl-md"
                                } ${isOpt ? "opacity-70" : ""}`}
                              >
                                <p className="leading-relaxed">{message.message}</p>
                                <p
                                  className={`text-[10px] mt-0.5 ${
                                    isMine ? "text-white/50" : "text-muted-foreground"
                                  }`}
                                >
                                  {formatTime(message.sent_at)}
                                  {isOpt && " · sending..."}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No messages yet. Say hi!
                        </p>
                      )}
                      <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div
                      className="border-t border-border/50 p-2 flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Emoji trigger */}
                      <div className="relative">
                        <button
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className={`shrink-0 h-9 w-9 rounded-lg transition-all flex items-center justify-center ${
                            showEmojiPicker
                              ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                              : "bg-secondary/30 hover:bg-secondary/50 text-muted-foreground"
                          }`}
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        {showEmojiPicker && (
                          <div
                            ref={emojiPickerRef}
                            className="absolute bottom-full mb-2 left-0 w-[280px] bg-card border border-border/50 rounded-xl shadow-2xl shadow-black/30 animate-fade-in z-20 overflow-hidden"
                          >
                            {/* Recent emojis */}
                            {recentEmojis.length > 0 && (
                              <div className="px-2.5 pt-2.5 pb-2 border-b border-border/30">
                                <div className="flex items-center gap-1 mb-1">
                                  <History className="h-2.5 w-2.5 text-muted-foreground" />
                                  <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
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

                            {/* Tabs */}
                            <div className="flex gap-1 px-2.5 pt-2 pb-1.5 border-b border-border/30">
                              {EMOJI_CATEGORIES.map((cat, i) => (
                                <button
                                  key={cat.label}
                                  onClick={() => setEmojiTab(i)}
                                  className={`text-[9px] font-medium px-2 py-0.5 rounded-lg transition-all ${
                                    emojiTab === i
                                      ? "bg-purple-500/15 text-purple-400"
                                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                  }`}
                                >
                                  {cat.label}
                                </button>
                              ))}
                            </div>

                            {/* Emoji grid */}
                            <div className="p-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                              <div className="grid grid-cols-6 gap-0.5">
                                {EMOJI_CATEGORIES[emojiTab].emojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleEmojiSelect(emoji)}
                                    className="h-8 w-8 flex items-center justify-center hover:bg-secondary/80 rounded-lg text-lg transition-all hover:scale-110 active:scale-95"
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
                        className="flex-1 bg-secondary/30 border-border/30 h-9 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => handleSend(item.user_id?.id)}
                        disabled={!newMessage.trim()}
                        className="shrink-0 h-9 w-9 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white disabled:opacity-30 transition-all hover:from-purple-500 hover:to-blue-500"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
