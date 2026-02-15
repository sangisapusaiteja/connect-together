"use client";

import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@*/components/ui/sheet";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Suspense, useEffect, useRef, useState } from "react";
import { PersonalChatRoomPage } from "@app/components/personalChatRoom";
import CryptoJS from "crypto-js";
import { useSearchParams } from "next/navigation";
import { useParamsStore } from "@zustandstore/redux";
import { Copy, Check, Send, MessageCircle, ArrowLeft, Users } from "lucide-react";

function ChatRoom({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState(false);
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

  useEffect(() => {
    if (encryptedRoomId && encryptedUserId) {
      try {
        const decryptedRoomIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomId),
          secretKey
        );
        const decryptedUserIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedUserId),
          secretKey
        );
        const decryptedRoomNameBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomName ?? ""),
          secretKey
        );
        const decryptedRoomCodeBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomCode ?? ""),
          secretKey
        );
        const decryptedRoomId = parseInt(
          decryptedRoomIdBytes.toString(CryptoJS.enc.Utf8),
          10
        );
        const decryptedUserId = parseInt(
          decryptedUserIdBytes.toString(CryptoJS.enc.Utf8),
          10
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
            "message, sent_at, user_id(id, user_name, profile_pic), room_id(id, room_name, room_code)"
          )
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });
        if (error) {
          console.error("Error fetching messages:", error);
          setError(error.message);
        } else {
          setMessageLength(data.length);
          setMessages(data);
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

  const handleSendMessage = async () => {
    if (!roomId || !newMessage.trim() || !userId) return;
    const { error } = await supabaseBrowserClient
      .from("messages")
      .insert([{ room_id: roomId, user_id: userId, message: newMessage }]);
    if (error) {
      setError("Failed to send message.");
    } else {
      setNewMessage("");
    }
  };

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

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
      <div className="flex flex-col justify-center items-center fixed inset-0 z-50 bg-background">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-4 animate-pulse">
          <MessageCircle className="h-6 w-6 text-white" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading your chat...</p>
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
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <Users className="h-5 w-5 text-muted-foreground" />
            </button>
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
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-5 py-4">
        {messages.length > 0 ? (
          <div className="max-w-3xl mx-auto space-y-1">
            {messages.map((message, index) => {
              const isCurrentUser = message.user_id?.id === userId;
              const showDate = shouldShowDate(index);
              const showAvatar =
                !isCurrentUser &&
                (index === messages.length - 1 ||
                  messages[index + 1]?.user_id?.id !== message.user_id?.id);
              const showName =
                !isCurrentUser &&
                (index === 0 || messages[index - 1]?.user_id?.id !== message.user_id?.id);

              return (
                <div key={index}>
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
                      <div
                        className={`group relative px-3 py-2 rounded-2xl text-sm break-words ${
                          isCurrentUser
                            ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-md"
                            : "bg-secondary/70 text-foreground rounded-bl-md"
                        }`}
                      >
                        <p className="leading-relaxed">{message.message}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isCurrentUser ? "text-white/60" : "text-muted-foreground"
                          }`}
                        >
                          {formatTime(message.sent_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
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
      </div>

      {/* Message Input */}
      <div className="shrink-0 border-t border-border/50 bg-card/50 backdrop-blur-xl p-3 sm:p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
            placeholder="Type a message..."
            className="flex-1 bg-secondary/50 border-border/50 h-11 rounded-xl text-sm placeholder:text-muted-foreground focus-visible:ring-purple-500/50"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20 disabled:opacity-30 disabled:shadow-none transition-all"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AboutPageWrapper() {
  const messageLength = useParamsStore((state) => state.messageLength);
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="h-8 w-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      }
    >
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatRoom onToggleSidebar={() => setShowSidebar(true)} />
        </div>

        {/* Desktop sidebar - always visible on lg+ */}
        {messageLength > 0 && (
          <div className="hidden lg:block w-[380px] border-l border-border/50">
            <PersonalChatRoomPage />
          </div>
        )}

        {/* Mobile sidebar - Sheet slide-over */}
        {messageLength > 0 && (
          <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
            <SheetContent side="right" className="w-[85vw] sm:w-[380px] p-0">
              <SheetTitle className="sr-only">Direct Messages</SheetTitle>
              <PersonalChatRoomPage />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </Suspense>
  );
}
