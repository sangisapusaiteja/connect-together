"use client";

import { supabaseBrowserClient } from "@utils/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@*/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { Send, Smile, History, X } from "lucide-react";
import CryptoJS from "crypto-js";
import { useSearchParams } from "next/navigation";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "Smileys", emojis: ["😀", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "😢", "😭", "😤", "😴", "🤗", "😇", "🙃", "😏", "😌", "😔"] },
  { label: "Gestures", emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "👊", "✊", "💪", "🫶", "🙏", "🤲", "👋", "🖖", "🤙"] },
  { label: "Objects", emojis: ["❤️", "💔", "🔥", "⭐", "✨", "💯", "🎉", "🎊", "💡", "🎯", "🧠", "👀", "💀", "🎁", "🏆", "🚀", "💎", "🔮"] },
  { label: "Symbols", emojis: ["✅", "❌", "💚", "💙", "💜", "🖤", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚪", "🟤", "♻️", "🛑"] },
];

interface FloatingDmPanelProps {
  targetUser: { id: number; user_name: string; profile_pic?: string } | null;
  onClose: () => void;
  onDrag?: (dx: number, dy: number) => void;
}

export const FloatingDmPanel = ({ targetUser, onClose, onDrag }: FloatingDmPanelProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [messageData, setMessageData] = useState<any[]>([]);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const headerDragRef = useRef<{ startX: number; startY: number } | null>(null);
  const didDragHeader = useRef(false);

  const secretKey = "key";
  const searchParams = useSearchParams();
  const encryptedRoomId = searchParams.get("roomId");
  const encryptedUserId = searchParams.get("userId");

  const [roomId, setRoomId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    try { const stored = localStorage.getItem("recentEmojis"); if (stored) setRecentEmojis(JSON.parse(stored)); } catch {}
  }, []);

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
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 12);
      try { localStorage.setItem("recentEmojis", JSON.stringify(next)); } catch {}
      return next;
    });
    setShowEmojiPicker(false);
  };

  if (!targetUser) return null;

  const initials = targetUser.user_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="w-[320px] sm:w-[360px] rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 animate-fade-in overflow-hidden flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 bg-card cursor-grab active:cursor-grabbing select-none"
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
              <AvatarFallback className="text-[9px] bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-300">{initials}</AvatarFallback>
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

      <div className="max-h-[320px] min-h-[160px] overflow-y-auto custom-scrollbar p-3 space-y-1.5">
        {messageData.length > 0 ? (
          messageData.map((message: any) => {
            const isMine = message.from_id === userId;
            return (
              <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[85%] break-words ${
                  isMine
                    ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-md"
                    : "bg-secondary/70 text-foreground rounded-bl-md"
                } ${message._optimistic ? "opacity-70" : ""}`}>
                  <p className="leading-relaxed">{message.message}</p>
                  <p className={`text-[10px] mt-0.5 ${isMine ? "text-white/50" : "text-muted-foreground"}`}>
                    {formatTime(message.sent_at)}{message._optimistic && " · sending..."}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Say hi!</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/30 p-2 flex items-center gap-1.5">
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`shrink-0 h-8 w-8 rounded-lg transition-all flex items-center justify-center ${
              showEmojiPicker ? "bg-purple-500/15 text-purple-400 border border-purple-500/30" : "bg-secondary/30 hover:bg-secondary/50 text-muted-foreground"
            }`}
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full mb-2 left-0 w-[260px] bg-card border border-border/50 rounded-xl shadow-2xl shadow-black/30 animate-fade-in z-20 overflow-hidden">
              {recentEmojis.length > 0 && (
                <div className="px-2 pt-2 pb-1.5 border-b border-border/30">
                  <div className="flex items-center gap-1 mb-1">
                    <History className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {recentEmojis.slice(0, 8).map((emoji) => (
                      <button key={emoji} onClick={() => handleEmojiSelect(emoji)} className="h-6 w-6 flex items-center justify-center hover:bg-secondary rounded-md text-sm transition-all hover:scale-110">{emoji}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-1 px-2 pt-1.5 pb-1 border-b border-border/30">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button key={cat.label} onClick={() => setEmojiTab(i)} className={`text-[8px] font-medium px-1.5 py-0.5 rounded-lg transition-all ${emojiTab === i ? "bg-purple-500/15 text-purple-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>{cat.label}</button>
                ))}
              </div>
              <div className="p-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-6 gap-0.5">
                  {EMOJI_CATEGORIES[emojiTab].emojis.map((emoji) => (
                    <button key={emoji} onClick={() => handleEmojiSelect(emoji)} className="h-7 w-7 flex items-center justify-center hover:bg-secondary/80 rounded-lg text-base transition-all hover:scale-110 active:scale-95">{emoji}</button>
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
    </div>
  );
};
