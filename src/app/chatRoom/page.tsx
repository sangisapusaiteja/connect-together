"use client";

import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { FloatingDmPanel } from "@app/components/personalChatRoom";
import CryptoJS from "crypto-js";
import { useSearchParams } from "next/navigation";
import { useParamsStore } from "@zustandstore/redux";
import {
  Copy, Check, Send, MessageCircle, ArrowLeft,
  ChevronDown, Smile, Paperclip, X, Loader2, History
} from "lucide-react";

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

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`animate-pulse rounded-md bg-secondary/50 ${className ?? ""}`} style={style} />
  );
}

function ChatRoom() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [roomUsers, setRoomUsers] = useState<any[]>([]);
  const [activeDmUser, setActiveDmUser] = useState<{ id: number; user_name: string; profile_pic?: string } | null>(null);
  const secretKey = "key";

  const searchParams = useSearchParams();
  const encryptedRoomId = searchParams.get("roomId");
  const encryptedUserId = searchParams.get("userId");
  const encryptedRoomName = searchParams.get("roomName");
  const encryptedRoomCode = searchParams.get("roomCode");

  const [roomId, setRoomId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  const setMessageLength = useParamsStore((state) => state.setMessageLength);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [reactions, setReactions] = useState<Record<number, string[]>>({});
  const [fileAttachments, setFileAttachments] = useState<File[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const messagesContainerRef = useRef<null | HTMLDivElement>(null);
  const emojiPickerRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<null | HTMLInputElement>(null);
  const [bubblePositions, setBubblePositions] = useState<Record<number, { x: number; y: number }>>({});
  const [panelOffset, setPanelOffset] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const didDragRef = useRef(false);
  const initialScrollDone = useRef(false);
  const scrollToBottomOnRender = useCallback((el: HTMLDivElement | null) => {
    messagesEndRef.current = el;
    if (el && !initialScrollDone.current) {
      initialScrollDone.current = true;
      el.scrollIntoView({ behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("recentEmojis");
      if (stored) setRecentEmojis(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (encryptedRoomId && encryptedUserId) {
      try {
        const decryptedRoomIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomId), secretKey
        );
        const decryptedUserIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedUserId), secretKey
        );
        const decryptedRoomNameBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomName ?? ""), secretKey
        );
        const decryptedRoomCodeBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomCode ?? ""), secretKey
        );
        const decryptedRoomId = parseInt(
          decryptedRoomIdBytes.toString(CryptoJS.enc.Utf8), 10
        );
        const decryptedUserId = parseInt(
          decryptedUserIdBytes.toString(CryptoJS.enc.Utf8), 10
        );
        const decryptedRoomName = decryptedRoomNameBytes.toString(CryptoJS.enc.Utf8);
        const decryptedRoomCode = decryptedRoomCodeBytes.toString(CryptoJS.enc.Utf8);
        if (isNaN(decryptedRoomId) || isNaN(decryptedUserId)) {
          throw new Error("Decryption resulted in invalid numbers");
        }
        setRoomId(decryptedRoomId);
        setUserId(decryptedUserId);
        setRoomName(decryptedRoomName);
        setRoomCode(decryptedRoomCode);
      } catch (e) {
        console.error("Decryption error:", e);
        setError("Decryption error occurred");
      }
    }
  }, [encryptedRoomId, encryptedUserId]);

  useEffect(() => {
    if (roomId === null) return;
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabaseBrowserClient
          .from("messages")
          .select(
            "id, message, sent_at, user_id(id, user_name, profile_pic), room_id(id, room_name, room_code)"
          )
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });
        if (error) {
          console.error("Error fetching messages:", error);
          setError(error.message);
        } else {
          const filteredData = data.filter((m: any) => !optimisticIds.has(`opt-${m.id}`));
          setMessageLength(data.length);
          setMessages(filteredData);
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
        setError("Something went wrong");
      }
    };
    fetchMessages();
    const messageSubscription = supabaseBrowserClient
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => { fetchMessages(); }
      )
      .subscribe();
    return () => {
      supabaseBrowserClient.removeChannel(messageSubscription);
    };
  }, [roomId]);

  // Fetch room users for floating chat heads
  useEffect(() => {
    if (roomId === null) return;
    const fetchUsers = async () => {
      const { data, error } = await supabaseBrowserClient
        .from("messages")
        .select("user_id(id, user_name, profile_pic)")
        .eq("room_id", roomId);
      if (!error && data) {
        const unique = Array.from(
          new Map(data.map((item: any) => [item.user_id.id, item.user_id])).values()
        );
        setRoomUsers(unique);
      }
    };
    fetchUsers();
    const sub = supabaseBrowserClient
      .channel(`room-users:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchUsers())
      .subscribe();
    return () => { supabaseBrowserClient.removeChannel(sub); };
  }, [roomId]);

  const handleSendMessage = async () => {
    if (!roomId || !newMessage.trim() || !userId) return;
    const tempId = `opt-${Date.now()}`;
    const text = newMessage;
    setNewMessage("");
    setShowEmojiPicker(false);
    setOptimisticIds((prev) => new Set(prev).add(tempId));

    const optimisticMsg = {
      id: tempId,
      _optimistic: true,
      message: text,
      sent_at: new Date().toISOString(),
      user_id: { id: userId, user_name: "You", profile_pic: profilePic },
      room_id: { id: roomId, room_name: roomName, room_code: roomCode },
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { error } = await supabaseBrowserClient
      .from("messages")
      .insert([{ room_id: roomId, user_id: userId, message: text }]);
    if (error) {
      setError("Failed to send message.");
      setMessages((prev) => prev.filter((m: any) => m.id !== tempId));
    }
    setOptimisticIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
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

  const handleReaction = (msgId: number, emoji: string) => {
    setReactions((prev) => {
      const existing = prev[msgId] || [];
      if (existing.includes(emoji)) {
        return { ...prev, [msgId]: existing.filter((e) => e !== emoji) };
      }
      return { ...prev, [msgId]: [...existing, emoji] };
    });
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFileAttachments((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeAttachment = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setFileAttachments((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-scroll on new messages only if near bottom
  useEffect(() => {
    if (messages.length === 0 || showScrollBtn) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode).then(() => {
        setCopyMessage(true);
        setTimeout(() => setCopyMessage(false), 2000);
      });
    }
  };

  const [profilePic, setProfilePic] = useState(null);

  useEffect(() => {
    const fetchProfilePic = async () => {
      try {
        const { data, error } = await supabaseBrowserClient
          .from("users")
          .select("profile_pic")
          .eq("id", userId)
          .single();
        if (error) {
          console.log("Error fetching profile picture:", error);
          return;
        }
        if (data) setProfilePic(data.profile_pic);
      } catch (err) {
        console.error("Error fetching profile picture:", err);
      }
    };
    if (userId) fetchProfilePic();
  }, [userId]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const shouldShowDate = (index: number) => {
    if (index === 0) return true;
    const curr = new Date(messages[index].sent_at).toDateString();
    const prev = new Date(messages[index - 1].sent_at).toDateString();
    return curr !== prev;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <header className="shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-xl px-3 sm:px-5 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </header>
        <div className="flex-1 p-4 space-y-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
              {i % 2 !== 0 && <Skeleton className="h-7 w-7 rounded-full shrink-0" />}
              <div className="space-y-2">
                <Skeleton
                  className={`h-8 rounded-2xl ${i % 2 === 0 ? "rounded-br-md" : "rounded-bl-md"}`}
                  style={{ width: `${60 + Math.random() * 120}px` }}
                />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
        <div className="shrink-0 border-t border-border/50 bg-card/50 p-4">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Chat Header */}
      <header className="shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-xl px-3 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="lg:hidden shrink-0 p-1.5 -ml-1.5 rounded-lg hover:bg-secondary/50 transition-colors">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </a>
            <Avatar className="h-10 w-10 shrink-0 border-2 border-purple-500/30">
              {profilePic ? (
                <AvatarImage src={profilePic} alt="Profile" className="object-cover" />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-xs font-semibold text-purple-300">
                  You
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">{roomName}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                Active now
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <span className="font-mono tracking-wider hidden sm:inline">{roomCode}</span>
              <span className="font-mono tracking-wider sm:hidden">{roomCode?.slice(0, 4)}...</span>
              {copyMessage ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-red-400 text-center">{error}</p>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-5 py-4 relative"
      >
        {messages.length > 0 ? (
          <div className="max-w-3xl mx-auto space-y-1">
            {messages.map((message: any, index) => {
              const msgId = message.id;
              const isCurrentUser = message.user_id?.id === userId;
              const showDate = shouldShowDate(index);
              const isOptimistic = message._optimistic;
              const showAvatar =
                !isCurrentUser &&
                (index === messages.length - 1 ||
                  messages[index + 1]?.user_id?.id !== message.user_id?.id);
              const showName =
                !isCurrentUser &&
                (index === 0 || messages[index - 1]?.user_id?.id !== message.user_id?.id);

              const messageReactions = reactions[msgId] || [];

              return (
                <div key={msgId}>
                  {showDate && (
                    <div className="flex justify-center py-3">
                      <span className="text-[10px] font-medium text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
                        {formatDate(message.sent_at)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex items-end gap-2 animate-message-in ${
                      isCurrentUser ? "justify-end" : "justify-start"
                    } ${showName && !isCurrentUser ? "mt-3" : "mt-0.5"}`}
                  >
                    {!isCurrentUser && (
                      <div className="w-7 shrink-0">
                        {showAvatar && (
                          <Avatar className="h-7 w-7 border border-border/50">
                            <AvatarImage
                              src={message.user_id?.profile_pic}
                              alt={message.user_id?.user_name}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-[10px] bg-secondary">
                              {getInitials(message.user_id?.user_name || "?")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}
                    <div
                      className={`flex flex-col max-w-[75%] sm:max-w-[65%] ${
                        isCurrentUser ? "items-end" : "items-start"
                      }`}
                    >
                      {showName && !isCurrentUser && (
                        <span className="text-[11px] font-medium text-muted-foreground mb-0.5 ml-3">
                          {message.user_id?.user_name}
                        </span>
                      )}
                      <div className="group relative">
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm break-words ${
                            isCurrentUser
                              ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-md"
                              : "bg-secondary/70 text-foreground rounded-bl-md"
                          } ${isOptimistic ? "opacity-70" : ""}`}
                        >
                          <p className="leading-relaxed">{message.message}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isCurrentUser ? "text-white/60" : "text-muted-foreground"
                            }`}
                          >
                            {formatTime(message.sent_at)}
                            {isOptimistic && " · sending..."}
                          </p>
                        </div>
                        {/* Message reactions */}
                        {messageReactions.length > 0 && (
                          <div className={`flex gap-0.5 mt-0.5 ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                            {messageReactions.map((emoji: string, i: number) => (
                              <button
                                key={i}
                                onClick={() => handleReaction(msgId, emoji)}
                                className="text-xs bg-secondary/50 hover:bg-secondary rounded-full px-1.5 py-0.5 transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Reaction buttons on hover */}
                        {!isOptimistic && (
                          <div className={`absolute -bottom-4 hidden group-hover:flex gap-0.5 bg-card border border-border/50 rounded-full px-1.5 py-0.5 shadow-lg z-10 ${isCurrentUser ? "right-0" : "left-0"}`}>
                            {EMOJI_CATEGORIES[1].emojis.slice(0, 4).map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msgId, emoji)}
                                className="text-xs hover:scale-125 transition-transform p-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={scrollToBottomOnRender} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No messages yet</p>
            <p className="text-xs text-muted-foreground">Be the first to say something!</p>
          </div>
        )}

        {/* Scroll to bottom FAB */}
        {showScrollBtn && (
          <div className="sticky bottom-4 flex justify-center">
            <button
              onClick={scrollToBottom}
              className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center hover:from-purple-500 hover:to-blue-500 transition-all animate-fade-in"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

      </div>

      {/* Message Input */}
      <div className="shrink-0 border-t border-border/50 bg-card/50 backdrop-blur-xl p-3 sm:p-4">
        <div className="max-w-3xl mx-auto">
          {/* File attachments preview */}
          {imagePreviews.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
              {imagePreviews.map((url, i) => (
                <div key={i} className="relative shrink-0">
                  <div className="h-16 w-16 rounded-lg overflow-hidden border border-border/50">
                    <img src={url} alt="attachment" className="h-full w-full object-cover" />
                  </div>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* File attach button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileAttach}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 h-11 w-11 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            {/* Emoji button */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`shrink-0 h-11 w-11 rounded-xl transition-all flex items-center justify-center ${
                  showEmojiPicker
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                    : "bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smile className="h-4 w-4" />
              </button>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full mb-2 left-0 w-[300px] sm:w-[320px] bg-card border border-border/50 rounded-xl shadow-2xl shadow-black/30 animate-fade-in z-20 overflow-hidden"
                >
                  {/* Recent emojis */}
                  {recentEmojis.length > 0 && (
                    <div className="px-3 pt-3 pb-2 border-b border-border/30">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <History className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {recentEmojis.slice(0, 8).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiSelect(emoji)}
                            className="h-7 w-7 flex items-center justify-center hover:bg-secondary rounded-md text-base transition-all hover:scale-110"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="flex gap-1 px-3 pt-2.5 pb-1.5 border-b border-border/30">
                    {EMOJI_CATEGORIES.map((cat, i) => (
                      <button
                        key={cat.label}
                        onClick={() => setEmojiTab(i)}
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all ${
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
                  <div className="p-2.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-6 gap-0.5">
                      {EMOJI_CATEGORIES[emojiTab].emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleEmojiSelect(emoji)}
                          className="h-9 w-9 flex items-center justify-center hover:bg-secondary/80 rounded-lg text-xl transition-all hover:scale-110 active:scale-95"
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
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 bg-secondary/50 border-border/50 h-11 rounded-xl text-sm placeholder:text-muted-foreground focus-visible:ring-purple-500/50"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20 disabled:opacity-30 disabled:shadow-none transition-all"
            >
              {fileUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Floating DM panel — positioned at bubble, draggable via header, follows bubble */}
      {activeDmUser && panelOffset && (() => {
        const users = roomUsers.filter((u: any) => u.id !== userId).slice(0, 5);
        const idx = users.findIndex((u: any) => u.id === activeDmUser.id);
        const defaultIndex = users.length - 1 - idx;
        const defaultLeft = typeof window !== 'undefined' ? window.innerWidth - 80 + defaultIndex * 4 : 1200;
        const defaultTop = typeof window !== 'undefined' ? window.innerHeight - 80 + defaultIndex * 4 : 600;
        const bubblePos = bubblePositions[activeDmUser.id] || { x: defaultLeft, y: defaultTop };
        const pw = 360, ph = 480;
        const panelX = Math.max(0, Math.min(bubblePos.x + panelOffset.x, typeof window !== 'undefined' ? window.innerWidth - pw : 1200));
        const panelY = Math.max(0, Math.min(bubblePos.y + panelOffset.y, typeof window !== 'undefined' ? window.innerHeight - ph : 600));
        return (
          <div className="fixed z-50" style={{ left: panelX, top: panelY }}>
            <FloatingDmPanel
              targetUser={activeDmUser}
              onClose={() => { setActiveDmUser(null); setPanelOffset(null); }}
              onDrag={(dx, dy) => {
                setBubblePositions((prev) => {
                  const cur = prev[activeDmUser.id] || { x: defaultLeft, y: defaultTop };
                  return { ...prev, [activeDmUser.id]: { x: cur.x + dx, y: cur.y + dy } };
                });
              }}
            />
          </div>
        );
      })()}

      {/* Floating chat heads — draggable over whole viewport */}
      {roomUsers.filter((u: any) => u.id !== userId).length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-40">
          {roomUsers
            .filter((u: any) => u.id !== userId)
            .slice(0, 5)
            .map((user: any, _i: number, arr: any[]) => {
              const pos = bubblePositions[user.id];
              const defaultIndex = arr.length - 1 - arr.indexOf(user);
              const defaultLeft = typeof window !== 'undefined' ? window.innerWidth - 80 + defaultIndex * 4 : 1200;
              const defaultTop = typeof window !== 'undefined' ? window.innerHeight - 80 + defaultIndex * 4 : 600;

              return (
                <div
                  key={user.id}
                  className="absolute pointer-events-auto"
                  style={{
                    left: pos ? `${pos.x}px` : `${defaultLeft}px`,
                    top: pos ? `${pos.y}px` : `${defaultTop}px`,
                    zIndex: activeDmUser?.id === user.id ? 60 : 40,
                  }}
                    onMouseDown={(e) => {
                    e.preventDefault();
                    didDragRef.current = false;
                    const currentPos = bubblePositions[user.id] || { x: defaultLeft, y: defaultTop };
                    const dragId = user.id;
                    const startX = e.clientX;
                    const startY = e.clientY;
                    draggingRef.current = {
                      id: dragId,
                      startX,
                      startY,
                      origX: currentPos.x,
                      origY: currentPos.y,
                    };
                    const handleMouseMove = (me: MouseEvent) => {
                      didDragRef.current = true;
                      if (!draggingRef.current) return;
                      const dx = me.clientX - draggingRef.current.startX;
                      const dy = me.clientY - draggingRef.current.startY;
                      const { origX, origY } = draggingRef.current;
                      setBubblePositions((prev) => ({
                        ...prev,
                        [dragId]: {
                          x: origX + dx,
                          y: origY + dy,
                        },
                      }));
                    };
                    const handleMouseUp = () => {
                      draggingRef.current = null;
                      document.removeEventListener("mousemove", handleMouseMove);
                      document.removeEventListener("mouseup", handleMouseUp);
                    };
                    document.addEventListener("mousemove", handleMouseMove);
                    document.addEventListener("mouseup", handleMouseUp);
                  }}
                >
                  <button
                    onClick={() => {
                      if (!didDragRef.current) {
                        if (activeDmUser?.id === user.id) {
                          setActiveDmUser(null);
                          setPanelOffset(null);
                        } else {
                          const bubblePos = bubblePositions[user.id] || { x: defaultLeft, y: defaultTop };
                          const panelX = bubblePos.x < 400 ? bubblePos.x + 56 : bubblePos.x - 368;
                          const panelY = Math.max(10, Math.min(bubblePos.y - 24, typeof window !== 'undefined' ? window.innerHeight - 480 : 600));
                          setPanelOffset({ x: panelX - bubblePos.x, y: panelY - bubblePos.y });
                          setActiveDmUser(user);
                        }
                      }
                    }}
                    className={`group relative h-12 w-12 rounded-full border-2 shadow-lg transition-shadow hover:shadow-xl cursor-pointer ${
                      activeDmUser?.id === user.id
                        ? "border-purple-500 shadow-purple-500/30"
                        : "border-border/50 bg-card hover:border-purple-500/50"
                    }`}
                  >
                    <Avatar className="h-full w-full">
                      <AvatarImage src={user.profile_pic} alt={user.user_name} className="object-cover" />
                      <AvatarFallback className="text-[10px] bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-300">
                        {user.user_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-card border border-border/50 text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                      {user.user_name}
                    </span>
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default function AboutPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="h-8 w-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      }
    >
      <div className="flex h-screen bg-background overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatRoom />
        </div>
      </div>
    </Suspense>
  );
}
