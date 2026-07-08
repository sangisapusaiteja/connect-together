"use client";

import { supabaseBrowserClient } from "@utils/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@*/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { Bubble, BubbleContent } from "@*/components/ui/bubble";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@*/components/ui/message";
import { Send, Smile, X } from "lucide-react";
import CryptoJS from "crypto-js";
import { useSearchParams } from "next/navigation";
import Picker from "@emoji-mart/react";
import emojiData from "@emoji-mart/data";
import { useTheme } from "next-themes";

interface FloatingDmPanelProps {
  targetUser: { id: number; user_name: string; profile_pic?: string } | null;
  onClose: () => void;
  onDrag?: (dx: number, dy: number) => void;
}

export const FloatingDmPanel = ({ targetUser, onClose, onDrag }: FloatingDmPanelProps) => {
  const { theme } = useTheme();
  const [newMessage, setNewMessage] = useState("");
  const [messageData, setMessageData] = useState<any[]>([]);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [panelSize, setPanelSize] = useState({ w: 360, h: 480 });
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const headerDragRef = useRef<{ startX: number; startY: number } | null>(null);
  const didDragHeader = useRef(false);
  const resizingRef = useRef(false);

  const secretKey = "key";
  const searchParams = useSearchParams();
  const encryptedRoomId = searchParams.get("roomId");
  const encryptedUserId = searchParams.get("userId");

  const [roomId, setRoomId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    if (encryptedRoomId && encryptedUserId) {
      try {
        const decryptedRoomIdBytes = CryptoJS.AES.decrypt(decodeURIComponent(encryptedRoomId), secretKey);
        const decryptedUserIdBytes = CryptoJS.AES.decrypt(decodeURIComponent(encryptedUserId), secretKey);
        const decryptedRoomId = parseInt(decryptedRoomIdBytes.toString(CryptoJS.enc.Utf8), 10);
        const decryptedUserId = parseInt(decryptedUserIdBytes.toString(CryptoJS.enc.Utf8), 10);
        if (isNaN(decryptedRoomId) || isNaN(decryptedUserId)) return;
        setRoomId(decryptedRoomId);
        setUserId(decryptedUserId);
      } catch (e) { console.error("Decryption error:", e); }
    }
  }, [encryptedRoomId, encryptedUserId]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messageData]);

  useEffect(() => {
    if (!userId || !targetUser || !roomId) return;
    const fetchPersonalMessages = async () => {
      const { data, error } = await supabaseBrowserClient
        .from("personal_messages")
        .select("*")
        .or(`and(from_id.eq.${userId},to_id.eq.${targetUser.id}),and(from_id.eq.${targetUser.id},to_id.eq.${userId})`)
        .eq("room_id", roomId)
        .order("sent_at", { ascending: true });
      if (error) { console.error("Error fetching data:", error.message); return; }
      setMessageData(data);
    };
    fetchPersonalMessages();
    const sub = supabaseBrowserClient
      .channel(`dm-${roomId}-${targetUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "personal_messages" }, () => fetchPersonalMessages())
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [userId, roomId, targetUser]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !roomId || !userId || !targetUser) return;
    const text = newMessage;
    const optId = `dm-opt-${Date.now()}`;
    setNewMessage("");
    setShowEmojiPicker(false);
    setOptimisticIds((prev) => new Set(prev).add(optId));
    setMessageData((prev) => [...prev, {
      id: optId, _optimistic: true, room_id: roomId,
      from_id: userId, to_id: targetUser.id, message: text, sent_at: new Date().toISOString(),
    }]);
    const { data, error } = await supabaseBrowserClient.from("personal_messages").insert([
      { room_id: roomId, from_id: userId, to_id: targetUser.id, message: text },
    ]).select();
    if (error) {
      console.error("Error sending:", error.message);
      setMessageData((prev) => prev.filter((m: any) => m.id !== optId));
      return;
    }
    setOptimisticIds((prev) => { const n = new Set(prev); n.delete(optId); return n; });
    setMessageData((prev) => {
      const withoutOpt = prev.filter((m: any) => m.id !== optId);
      return data?.[0] ? [...withoutOpt, data[0]] : withoutOpt;
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  if (!targetUser) return null;

  const initials = targetUser.user_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div
      className="relative rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 animate-fade-in overflow-hidden flex flex-col"
      style={{ width: panelSize.w, height: panelSize.h }}
    >
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 bg-card cursor-grab active:cursor-grabbing select-none shrink-0"
        onMouseDown={(e) => {
          if (!onDrag) return;
          e.preventDefault();
          didDragHeader.current = false;
          headerDragRef.current = { startX: e.clientX, startY: e.clientY };
          const handleMouseMove = (me: MouseEvent) => {
            didDragHeader.current = true;
            if (!headerDragRef.current) return;
            onDrag(me.clientX - headerDragRef.current.startX, me.clientY - headerDragRef.current.startY);
            headerDragRef.current = { startX: me.clientX, startY: me.clientY };
          };
          const handleMouseUp = () => {
            headerDragRef.current = null;
            didDragHeader.current = false;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };
          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <Avatar className="h-8 w-8 border border-border/50">
              <AvatarImage src={targetUser.profile_pic} alt={targetUser.user_name} className="object-cover" />
              <AvatarFallback className="text-[9px] bg-gradient-to-br accent-avatar-bg">{initials}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-card" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">{targetUser.user_name}</p>
            <p className="text-[10px] text-muted-foreground">Direct message</p>
          </div>
        </div>
        <button onClick={() => { if (!didDragHeader.current) onClose(); }} className="h-7 w-7 rounded-lg hover:bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 min-h-[100px]">
        {messageData.length > 0 ? (
          messageData.map((message: any) => {
            const isMine = message.from_id === userId;
            return (
              <Message key={message.id} align={isMine ? "end" : "start"}>
                <MessageContent>
                  <Bubble
                    variant={isMine ? "default" : "secondary"}
                    align={isMine ? "end" : "start"}
                    className={message._optimistic ? "opacity-70" : ""}
                    style={isMine ? { background: "linear-gradient(135deg, #3b82f6, #6366f1)" } : undefined}
                  >
                    <BubbleContent>
                      <p className="leading-relaxed">{message.message}</p>
                    </BubbleContent>
                  </Bubble>
                  <MessageFooter>
                    {formatTime(message.sent_at)}{message._optimistic && " · sending..."}
                  </MessageFooter>
                </MessageContent>
              </Message>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Say hi!</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/30 p-2 flex items-center gap-1.5 shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`shrink-0 h-8 w-8 rounded-lg transition-all flex items-center justify-center ${
              showEmojiPicker ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary/30 hover:bg-secondary/50 text-muted-foreground"
            }`}
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full mb-2 left-0 z-20 scale-[0.72] origin-bottom-left">
              <Picker
                data={emojiData}
                onEmojiSelect={(emoji: any) => handleEmojiSelect(emoji.native)}
                theme={theme === "dark" ? "dark" : "light"}
                previewPosition="none"
                skinTonePosition="none"
                set="native"
                maxFrequentRows={1}
                perLine={7}
              />
            </div>
          )}
        </div>
        <Input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
          placeholder="Message..."
          className="flex-1 bg-secondary/30 border-border/30 h-8 rounded-lg text-xs"
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className="shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white disabled:opacity-30 transition-all hover:from-purple-500 hover:to-blue-500"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          resizingRef.current = true;
          const startX = e.clientX;
          const startY = e.clientY;
          const startW = panelSize.w;
          const startH = panelSize.h;
          const handleMouseMove = (me: MouseEvent) => {
            if (!resizingRef.current) return;
            setPanelSize({
              w: Math.max(240, startW + (me.clientX - startX)),
              h: Math.max(200, startH + (me.clientY - startY)),
            });
          };
          const handleMouseUp = () => {
            resizingRef.current = false;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };
          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      >
        <svg className="absolute bottom-1 right-1 text-muted-foreground/40" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 9L9 1M4 9L9 4M7 9L9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
