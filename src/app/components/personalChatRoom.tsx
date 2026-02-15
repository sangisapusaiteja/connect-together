"use client";

import { supabaseBrowserClient } from "@utils/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@*/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { Send, ChevronDown, MessageSquare } from "lucide-react";
import CryptoJS from "crypto-js";
import { useSearchParams } from "next/navigation";

export const PersonalChatRoomPage = () => {
  const [uniqueUsers, setUniqueUsers] = useState<any[]>([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageData, setMessageData] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

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
          decodeURIComponent(encryptedRoomId),
          secretKey
        );
        const decryptedUserIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedUserId),
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
        () => { fetchPersonalMessages(); }
      )
      .subscribe();
    return () => {
      messageSubscription.unsubscribe();
    };
  }, [activeUserId]);

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
    handleUserDetails(roomId, userId, toId, newMessage);
    setNewMessage("");
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
            return (
              <div key={item.user_id.id} className="animate-fade-in">
                {/* User row */}
                <button
                  onClick={() => handleClick(item.user_id.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
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
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isActive ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Expanded chat */}
                {isActive && (
                  <div className="mx-1 mt-1 mb-2 rounded-xl border border-border/50 bg-card/50 overflow-hidden animate-fade-in">
                    {/* Messages */}
                    <div className="max-h-[350px] min-h-[80px] overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                      {messageData && messageData.length > 0 ? (
                        messageData.map((message: any) => {
                          const isMine = message.from_id === userId;
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
                                }`}
                              >
                                <p className="leading-relaxed">{message.message}</p>
                                <p
                                  className={`text-[10px] mt-0.5 ${
                                    isMine ? "text-white/50" : "text-muted-foreground"
                                  }`}
                                >
                                  {formatTime(message.sent_at)}
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
                      <Input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSend(item.user_id?.id);
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
