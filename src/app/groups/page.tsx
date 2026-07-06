"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { Button } from "@*/components/ui/button";
import { MessageCircle, LogIn, Users, ChevronRight, LogOut } from "lucide-react";
import CryptoJS from "crypto-js";

const secretKey = "key";

export default function GroupsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const username = localStorage.getItem("last-username");
    if (!username) {
      router.replace("/");
      return;
    }
    fetchGroups(username);
  }, []);

  const fetchGroups = async (username: string) => {
    setLoading(true);
    setError("");
    const { data: userEntries, error: err } = await supabaseBrowserClient
      .from("users")
      .select("id, room_id, user_name, profile_pic, rooms!users_room_id_fkey(id, room_name, room_code, group_photo, description)")
      .eq("username", username);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    if (!userEntries || userEntries.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }
    const roomsWithMeta = await Promise.all(
      userEntries.map(async (entry: any) => {
        const { count } = await supabaseBrowserClient
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("room_id", entry.room_id);
        const { data: lastMsg } = await supabaseBrowserClient
          .from("messages")
          .select("message, sent_at")
          .eq("room_id", entry.room_id)
          .order("sent_at", { ascending: false })
          .limit(1);
        return {
          userId: entry.id,
          user_name: entry.user_name,
          profile_pic: entry.profile_pic,
          roomId: entry.room_id,
          room: entry.rooms,
          memberCount: count || 0,
          lastMessage: lastMsg?.[0] || null,
        };
      })
    );
    setRooms(roomsWithMeta);
    setLoading(false);
  };

  const enterRoom = (roomId: number, userId: number, roomName: string, roomCode: string) => {
    const encryptedRoomId = CryptoJS.AES.encrypt(String(roomId), secretKey).toString();
    const encryptedUserId = CryptoJS.AES.encrypt(String(userId), secretKey).toString();
    const encryptedRoomName = CryptoJS.AES.encrypt(roomName, secretKey).toString();
    const encryptedRoomCode = CryptoJS.AES.encrypt(roomCode, secretKey).toString();
    router.push(
      `/chatRoom?roomId=${encodeURIComponent(encryptedRoomId)}&userId=${encodeURIComponent(encryptedUserId)}&roomName=${encodeURIComponent(encryptedRoomName)}&roomCode=${encodeURIComponent(encryptedRoomCode)}`
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">My Groups</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <LogIn className="h-3.5 w-3.5" />
              Join New
            </a>
            <button
              onClick={() => { localStorage.removeItem("last-username"); router.push("/"); }}
              className="h-8 w-8 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 border-2 border-ring/30 border-t-ring rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4 ring-1 ring-border/30">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No groups found</p>
            <p className="text-xs text-muted-foreground mb-4">Join a room to see it here</p>
            <a href="/join">
              <Button variant="outline" className="border-border/50 text-xs">
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Join a Room
              </Button>
            </a>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="space-y-2">
            {rooms.map((item: any) => (
              <button
                key={item.roomId}
                onClick={() => enterRoom(item.roomId, item.userId, item.room.room_name, item.room.room_code)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card/50 border border-border/40 hover:bg-secondary/30 hover:border-border/60 transition-all group text-left"
              >
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12 ring-2 ring-border/50 group-hover:ring-ring/30 transition-all">
                    {item.room.group_photo ? (
                      <AvatarImage src={item.room.group_photo} alt="" className="object-cover" />
                    ) : (
                      <AvatarFallback className="text-sm font-bold accent-avatar-bg">
                        {item.room.room_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{item.room.room_name}</p>
                    {item.lastMessage && (
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{formatTime(item.lastMessage.sent_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {item.memberCount}
                    </span>
                    {item.lastMessage && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[11px] text-muted-foreground/50 truncate">{item.lastMessage.message}</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
