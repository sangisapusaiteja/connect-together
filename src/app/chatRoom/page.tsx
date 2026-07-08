"use client";

import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@*/components/ui/avatar";
import { Bubble, BubbleContent, BubbleReactions, BubbleGroup } from "@*/components/ui/bubble";
import { Message, MessageAvatar, MessageContent, MessageHeader, MessageFooter, MessageGroup } from "@*/components/ui/message";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { FloatingDmPanel } from "@app/components/personalChatRoom";
import CryptoJS from "crypto-js";
import { useSearchParams, useRouter } from "next/navigation";
import { useParamsStore } from "@zustandstore/redux";
import {
  Copy, Check, Send, MessageCircle, ArrowLeft,
  ChevronDown, ChevronLeft, ChevronRight, Smile, Paperclip, X, Loader2, History, Sun, Moon, Users, Palette, Share2, Mail, MessageSquare, Camera, Edit3, CheckCheck, LogOut, Minus, Square, User, Expand
} from "lucide-react";
import Picker from "@emoji-mart/react";
import emojiData from "@emoji-mart/data";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮"];

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`animate-pulse rounded-md bg-secondary/50 ${className ?? ""}`} style={style} />
  );
}

const ACCENT_PACKS = [
  { id: "default", name: "Blue", gradient: "from-blue-400 to-indigo-400", colors: ["#3b82f6", "#6366f1", "#818cf8"] },
  { id: "ocean", name: "Ocean", gradient: "from-blue-400 to-cyan-400", colors: ["#3b82f6", "#06b6d4", "#0ea5e9"] },
  { id: "forest", name: "Forest", gradient: "from-green-400 to-emerald-400", colors: ["#22c55e", "#10b981", "#059669"] },
  { id: "sunset", name: "Sunset", gradient: "from-orange-400 to-rose-400", colors: ["#f97316", "#ef4444", "#d946ef"] },
  { id: "rose", name: "Rose", gradient: "from-pink-400 to-purple-400", colors: ["#ec4899", "#d946ef", "#a855f7"] },
  { id: "midnight", name: "Midnight", gradient: "from-indigo-400 to-blue-400", colors: ["#4f46e5", "#6366f1", "#818cf8"] },
];

function ChatRoom({ showProfileModal, setShowProfileModal, accentPack, setAccentPack }: { showProfileModal: boolean; setShowProfileModal: (v: boolean) => void; accentPack: string; setAccentPack: (v: string) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [mediaLightbox, setMediaLightbox] = useState<{ url: string; sender: string; sent_at: string }[] | null>(null);
  const [mediaLightboxIndex, setMediaLightboxIndex] = useState(0);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [roomUsers, setRoomUsers] = useState<any[]>([]);
  const [activeDmUser, setActiveDmUser] = useState<{ id: number; user_name: string; profile_pic?: string } | null>(null);
  const [creatorId, setCreatorId] = useState<number | null>(null);
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [myBio, setMyBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [editingProfilePic, setEditingProfilePic] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [showMobileInfo, setShowMobileInfo] = useState(false);
  const [showGroups, setShowGroups] = useState(true);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [hasRoom, setHasRoom] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const typingTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});
  const typingChannelRef = useRef<any>(null);
  const secretKey = "key";
  const router = useRouter();

  const navigateToGroup = (g: any) => {
    const encryptedRoomId = CryptoJS.AES.encrypt(String(g.room_id), secretKey).toString();
    const encryptedUserId = CryptoJS.AES.encrypt(String(g.id), secretKey).toString();
    const encryptedRoomName = CryptoJS.AES.encrypt(g.rooms.room_name, secretKey).toString();
    const encryptedRoomCode = CryptoJS.AES.encrypt(g.rooms.room_code, secretKey).toString();
    router.push(`/chatRoom?roomId=${encodeURIComponent(encryptedRoomId)}&userId=${encodeURIComponent(encryptedUserId)}&roomName=${encodeURIComponent(encryptedRoomName)}&roomCode=${encodeURIComponent(encryptedRoomCode)}`);
  };

  const searchParams = useSearchParams();
  const encryptedRoomId = searchParams.get("roomId");
  const encryptedUserId = searchParams.get("userId");
  const encryptedRoomName = searchParams.get("roomName");
  const encryptedRoomCode = searchParams.get("roomCode");
  const usernameParam = searchParams.get("username");

  const [roomId, setRoomId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [roomName, setRoomName] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  const setMessageLength = useParamsStore((state) => state.setMessageLength);
  const { theme, setTheme } = useTheme();

  const currentPack = ACCENT_PACKS.find((p) => p.id === accentPack) || ACCENT_PACKS[0];
  const accentGradient = `linear-gradient(135deg, ${currentPack.colors[0]}, ${currentPack.colors[2]})`;
  const accentGradientStyle = { background: accentGradient } as React.CSSProperties;

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [reactions, setReactions] = useState<Record<number, string[]>>({});
  const [fileAttachments, setFileAttachments] = useState<File[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const messagesContainerRef = useRef<null | HTMLDivElement>(null);
  const emojiPickerRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<null | HTMLInputElement>(null);
  const [dmPanelPos, setDmPanelPos] = useState<{ x: number; y: number } | null>(null);
  const initialScrollDone = useRef(false);
  const scrollToBottomOnRender = useCallback((el: HTMLDivElement | null) => {
    messagesEndRef.current = el;
    if (el && !initialScrollDone.current) {
      initialScrollDone.current = true;
      el.scrollIntoView({ behavior: "auto" });
    }
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
        setHasRoom(true);
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
            "id, message, images, sent_at, user_id(id, user_name, profile_pic), room_id(id, room_name, room_code)"
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
        .select("user_id(id, user_name, profile_pic, bio, is_online, last_seen)")
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

  // Fetch user's groups for sidebar — always run (even without roomId)
  useEffect(() => {
    const uname = usernameParam || localStorage.getItem("last-username");
    if (!uname) return;
    setCurrentUsername(uname);
    const fetchGroups = async () => {
      const { data: entries } = await supabaseBrowserClient
        .from("users")
        .select("id, room_id, user_name, rooms!users_room_id_fkey(id, room_name, room_code, group_photo)")
        .eq("username", uname);
      if (entries) {
        const withCounts = await Promise.all(
          entries.map(async (e: any) => {
            const { count } = await supabaseBrowserClient
              .from("users")
              .select("id", { count: "exact", head: true })
              .eq("room_id", e.room_id);
            return { ...e, memberCount: count || 0 };
          })
        );
        setMyGroups(withCounts);
      }
      setGroupsLoaded(true);
    };
    fetchGroups();
  }, [usernameParam]);

  // Online status — set online on mount, heartbeat every 30s, offline on unmount
  useEffect(() => {
    if (!userId || !roomId) return;
    const setOnline = async (online: boolean) => {
      try {
        await supabaseBrowserClient
          .from("users")
          .update({ is_online: online, last_seen: new Date().toISOString() })
          .eq("id", userId);
      } catch (e) {
        console.error("Failed to update online status:", e);
      }
    };
    setOnline(true);
    const interval = setInterval(() => setOnline(true), 30000);
    const handleBeforeUnload = () => {
      const key = process.env.NEXT_PUBLIC_SUPABASE_KEY || "";
      fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${userId}`,
        {
          method: "PATCH",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ is_online: false, last_seen: new Date().toISOString() }),
        }
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setOnline(false);
    };
  }, [userId, roomId]);

  // Realtime subscription for online status changes + periodic fallback
  useEffect(() => {
    if (!roomId) return;
    const channel = supabaseBrowserClient
      .channel(`online-status:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as any;
          setRoomUsers((prev) =>
            prev.map((u: any) =>
              u.id === updated.id
                ? { ...u, is_online: updated.is_online, last_seen: updated.last_seen }
                : u
            )
          );
        }
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          console.warn("Online status channel status:", status);
        }
      });
    // Fallback: refresh online status every 15s in case realtime isn't enabled
    const fallbackInterval = setInterval(async () => {
      const { data } = await supabaseBrowserClient
        .from("users")
        .select("id, is_online, last_seen")
        .eq("room_id", roomId);
      if (data) {
        setRoomUsers((prev) =>
          prev.map((u: any) => {
            const match = data.find((d: any) => d.id === u.id);
            return match ? { ...u, is_online: match.is_online, last_seen: match.last_seen } : u;
          })
        );
      }
    }, 15000);
    return () => {
      supabaseBrowserClient.removeChannel(channel);
      clearInterval(fallbackInterval);
    };
  }, [roomId]);

  // Typing indicator — broadcast + subscribe
  useEffect(() => {
    if (!roomId || !userId) return;
    const channel = supabaseBrowserClient.channel(`typing:${roomId}`);
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId: typerId, userName } = payload.payload;
        if (typerId === userId) return;
        setTypingUsers((prev) => ({ ...prev, [typerId]: userName }));
        if (typingTimeoutRef.current[typerId]) clearTimeout(typingTimeoutRef.current[typerId]);
        typingTimeoutRef.current[typerId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[typerId];
            return next;
          });
          delete typingTimeoutRef.current[typerId];
        }, 3000);
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      supabaseBrowserClient.removeChannel(channel);
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
      typingTimeoutRef.current = {};
    };
  }, [roomId, userId]);

  const broadcastTyping = useCallback(() => {
    if (!typingChannelRef.current || !userId) return;
    const myName = roomUsers.find((u: any) => u.id === userId)?.user_name || "Someone";
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, userName: myName },
    });
  }, [userId, roomUsers]);

  useEffect(() => {
    if (roomId === null) return;
    supabaseBrowserClient
      .from("rooms")
      .select("created_by, group_photo, description")
      .eq("id", roomId)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.created_by) setCreatorId(data.created_by);
          if (data.group_photo) setGroupPhoto(data.group_photo);
          if (data.description) setDescription(data.description);
        }
      });
  }, [roomId]);

  const handleSaveDescription = async () => {
    if (!roomId || !descriptionDraft.trim()) return;
    const { error } = await supabaseBrowserClient
      .from("rooms")
      .update({ description: descriptionDraft.trim() })
      .eq("id", roomId);
    if (!error) {
      setDescription(descriptionDraft.trim());
      setEditingDescription(false);
    }
  };

  const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId) return;
    setUploadingPhoto(true);
    const filePath = `group-photos/${roomId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabaseBrowserClient.storage
      .from("avatars")
      .upload(filePath, file);
    if (uploadError) { setUploadingPhoto(false); return; }
    const { data: urlData } = supabaseBrowserClient.storage
      .from("avatars")
      .getPublicUrl(filePath);
    const publicUrl = urlData?.publicUrl;
    if (publicUrl) {
      const { error: updateError } = await supabaseBrowserClient
        .from("rooms")
        .update({ group_photo: publicUrl })
        .eq("id", roomId);
      if (!updateError) setGroupPhoto(publicUrl);
    }
    setUploadingPhoto(false);
  };

  const handleSendMessage = async () => {
    if (!roomId || ((!newMessage.trim()) && fileAttachments.length === 0) || !userId) return;
    const tempId = `opt-${Date.now()}`;
    const text = newMessage;
    setNewMessage("");
    setShowEmojiPicker(false);
    setOptimisticIds((prev) => new Set(prev).add(tempId));

    // Upload images
    const imageUrls: string[] = [];
    for (const file of fileAttachments) {
      const filePath = `chat-images/${roomId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabaseBrowserClient.storage
        .from("avatars")
        .upload(filePath, file);
      if (!uploadError) {
        const { data: urlData } = supabaseBrowserClient.storage
          .from("avatars")
          .getPublicUrl(filePath);
        if (urlData?.publicUrl) imageUrls.push(urlData.publicUrl);
      }
    }
    const imagesJson = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null;

    const optimisticMsg = {
      id: tempId,
      _optimistic: true,
      message: text,
      images: imagesJson,
      sent_at: new Date().toISOString(),
      user_id: { id: userId, user_name: "You", profile_pic: profilePic },
      room_id: { id: roomId, room_name: roomName, room_code: roomCode },
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setFileAttachments([]);
    setImagePreviews([]);

    const { error } = await supabaseBrowserClient
      .from("messages")
      .insert([{ room_id: roomId, user_id: userId, message: text, images: imagesJson }]);
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

  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: userData } = await supabaseBrowserClient
          .from("users")
          .select("username")
          .eq("id", userId)
          .single();
        if (!userData?.username) return;
        const { data, error } = await supabaseBrowserClient
          .from("users")
          .select("profile_pic, bio")
          .eq("username", userData.username)
          .limit(1)
          .single();
        if (error) {
          console.log("Error fetching profile:", error);
          return;
        }
        if (data) {
          setProfilePic(data.profile_pic);
          if (data.bio) setMyBio(data.bio);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };
    if (userId) fetchProfile();
  }, [userId]);

  const handleSaveBio = async () => {
    if (!userId || !bioDraft.trim()) return;
    const { error } = await supabaseBrowserClient
      .from("users")
      .update({ bio: bioDraft.trim() })
      .eq("id", userId);
    if (!error) {
      setMyBio(bioDraft.trim());
      setEditingBio(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!userId || !displayNameDraft.trim()) return;
    const { error } = await supabaseBrowserClient
      .from("users")
      .update({ user_name: displayNameDraft.trim() })
      .eq("id", userId);
    if (!error) {
      setEditingDisplayName(false);
      setRoomUsers((prev) =>
        prev.map((u: any) => (u.id === userId ? { ...u, user_name: displayNameDraft.trim() } : u))
      );
    }
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setEditingProfilePic(true);
    const filePath = `profile-pics/${userId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabaseBrowserClient.storage
      .from("avatars")
      .upload(filePath, file);
    if (uploadError) { setEditingProfilePic(false); return; }
    const { data: urlData } = supabaseBrowserClient.storage
      .from("avatars")
      .getPublicUrl(filePath);
    const publicUrl = urlData?.publicUrl;
    if (publicUrl) {
      const { data: userData } = await supabaseBrowserClient
        .from("users")
        .select("username")
        .eq("id", userId)
        .single();
      if (userData?.username) {
        await supabaseBrowserClient
          .from("users")
          .update({ profile_pic: publicUrl })
          .eq("username", userData.username);
      }
      setProfilePic(publicUrl);
    }
    setEditingProfilePic(false);
  };

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
      <div className="flex-1 flex flex-row min-h-0 bg-background">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex w-[300px] shrink-0 flex-col bg-card/40">
          <div className="shrink-0 px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex-1 px-3 py-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Chat skeleton */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="shrink-0 px-3 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
          <div className="flex-1 p-4 space-y-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                {i % 2 !== 0 && <Skeleton className="h-7 w-7 rounded-full shrink-0" />}
                <div className="space-y-2">
                  <Skeleton className={`h-8 rounded-2xl ${i % 2 === 0 ? "rounded-br-md" : "rounded-bl-md"}`} style={{ width: `${80 + Math.random() * 100}px` }} />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
          <div className="shrink-0 px-3 py-3">
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
        {/* Right panel skeleton */}
        <div className="hidden lg:flex w-[340px] shrink-0 flex-col bg-card/40">
          <Skeleton className="h-44 w-full rounded-none" />
          <div className="flex-1 px-5 py-5 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-12 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-12 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-row min-h-0 bg-background">
      {/* Groups Sidebar — always visible on desktop when loaded */}
      {groupsLoaded && (
        <div className="hidden lg:flex w-[300px] shrink-0 flex-col bg-card/40">
          <div className="shrink-0 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Groups</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-1">
            {myGroups.map((g: any) => {
              const isActive = g.room_id === roomId;
              return (
                <button
                  key={g.room_id}
                  onClick={() => { if (!isActive) navigateToGroup(g); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${isActive ? "bg-ring/10 ring-1 ring-ring/20" : "hover:bg-secondary/30"}`}
                >
                  <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/40">
                    {g.rooms.group_photo ? <AvatarImage src={g.rooms.group_photo} alt="" className="object-cover" /> : <AvatarFallback className="text-[10px] accent-avatar-bg">{g.rooms.room_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}</AvatarFallback>}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-foreground truncate leading-tight">{g.rooms.room_name}</p>
                    <p className="text-xs text-muted-foreground/60">{g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              );
            })}
            {myGroups.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No groups yet</p>}
          </div>
        </div>
      )}

      {/* Mobile Groups Toggle */}
      {!hasRoom && (
        <div className="lg:hidden fixed bottom-4 left-4 z-40">
          <button onClick={() => setShowGroups(!showGroups)} className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg flex items-center justify-center">
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>
      )}
      {showGroups && groupsLoaded && !hasRoom && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGroups(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[75vw] max-w-[300px] bg-card border-r border-border/50 shadow-2xl animate-fade-in flex flex-col">
            <div className="shrink-0 border-b border-border/50 px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest">My Groups</h3>
              <button onClick={() => setShowGroups(false)} className="h-7 w-7 rounded-lg hover:bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-1">
              {myGroups.map((g: any) => (
                <button key={g.room_id} onClick={() => navigateToGroup(g)} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-secondary/30 transition-all text-left">
                  <Avatar className="h-9 w-9 shrink-0 ring-2 ring-border/50">
                    {g.rooms.group_photo ? <AvatarImage src={g.rooms.group_photo} alt="" className="object-cover" /> : <AvatarFallback className="text-[9px] accent-avatar-bg">{g.rooms.room_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}</AvatarFallback>}
                  </Avatar>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground truncate">{g.rooms.room_name}</p></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasRoom ? <><div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <header className="shrink-0 bg-card/40 px-0 py-3">
          <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-3 min-w-0">
              <a href={`/chatRoom?username=${currentUsername}`} className="shrink-0 p-2 -ml-2 rounded-xl hover:bg-secondary/50 transition-colors">
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </a>
              <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/50">
                {groupPhoto ? (
                  <AvatarImage src={groupPhoto} alt="" className="object-cover" />
                ) : (
                  <AvatarFallback className="text-xs accent-avatar-bg">
                    {(roomName || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate leading-tight">{roomName}</h2>
                {Object.keys(typingUsers).length > 0 ? (
                  <p className="text-xs text-muted-foreground/70 animate-fade-in">
                    <span className="text-ring">{Object.values(typingUsers).join(", ")}</span>
                    {Object.keys(typingUsers).length === 1 ? " is typing" : " are typing"}
                    <span className="inline-flex ml-0.5">
                      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                    {roomUsers.length} member{roomUsers.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowMobileInfo(true)}
                className="lg:hidden h-9 w-9 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Room info"
              >
                <Users className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Messages Area */}
        <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-0 relative accent-chat-bg"
      >
          {messages.length > 0 ? (
            <div className="space-y-0.5 px-2">
            {messages.map((message: any, index) => {
              const msgId = message.id;
              const isCurrentUser = message.user_id?.id === userId;
              const showDate = shouldShowDate(index);
              const isOptimistic = message._optimistic;
              const showAvatar = true;
              const showName =
                !isCurrentUser &&
                (index === 0 || messages[index - 1]?.user_id?.id !== message.user_id?.id);

              const messageReactions = reactions[msgId] || [];

              return (
                <div key={msgId}>
                  {showDate && (
                    <div className="flex justify-center py-4">
                      <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-4 py-1.5 rounded-full">
                        {formatDate(message.sent_at)}
                      </span>
                    </div>
                  )}
                  <Message align={isCurrentUser ? "end" : "start"} className={`animate-message-in ${showName && !isCurrentUser ? "mt-3" : "mt-0.5"}`}>
                    <MessageAvatar>
                      {showAvatar && (
                        <Avatar className="h-9 w-9 border border-border/50">
                          <AvatarImage
                            src={isCurrentUser ? (profilePic ?? undefined) : message.user_id?.profile_pic}
                            alt={isCurrentUser ? "You" : message.user_id?.user_name}
                            className="object-cover"
                          />
                          <AvatarFallback className="text-xs bg-secondary">
                            {isCurrentUser ? getInitials("You") : getInitials(message.user_id?.user_name || "?")}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </MessageAvatar>
                    <MessageContent>
                      {showName && !isCurrentUser && (
                        <MessageHeader>{message.user_id?.user_name}</MessageHeader>
                      )}
                      <div className="group relative">
                        <Bubble
                          variant={isCurrentUser ? "default" : "secondary"}
                          align={isCurrentUser ? "end" : "start"}
                          className={isOptimistic ? "opacity-70" : ""}
                          style={isCurrentUser ? { background: `linear-gradient(135deg, ${currentPack.colors[0]}, ${currentPack.colors[2]})` } : undefined}
                        >
                          <BubbleContent>
                            {(() => {
                              let parsedImages: string[] = [];
                              try {
                                if (message.images) parsedImages = JSON.parse(message.images);
                              } catch {}
                              return parsedImages.length > 0 && (
                                <div className={`flex gap-2 mb-2 ${parsedImages.length === 1 ? "" : "flex-wrap"}`}>
                                  {parsedImages.map((url: string, i: number) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={url}
                                        alt="attachment"
                                        className="rounded-lg object-cover max-h-48 max-w-[240px] cursor-pointer hover:opacity-90 transition-opacity"
                                      />
                                    </a>
                                  ))}
                                </div>
                              );
                            })()}
                            {message.message && <p className="leading-relaxed">{message.message}</p>}
                          </BubbleContent>
                          {messageReactions.length > 0 && (
                            <BubbleReactions role="img" aria-label={`Reactions: ${messageReactions.join(", ")}`}>
                              {messageReactions.map((emoji: string, i: number) => (
                                <button
                                  key={i}
                                  onClick={() => handleReaction(msgId, emoji)}
                                  className="text-xs bg-secondary/50 hover:bg-secondary rounded-full px-1.5 py-0.5 transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </BubbleReactions>
                          )}
                        </Bubble>
                        {!isOptimistic && (
                          <div className={`absolute -bottom-5 hidden group-hover:flex gap-1 bg-card border border-border/50 rounded-full px-2 py-1 shadow-lg z-10 ${isCurrentUser ? "right-0" : "left-0"}`}>
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msgId, emoji)}
                                className="text-sm hover:scale-125 transition-transform p-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <MessageFooter>
                        {formatTime(message.sent_at)}
                        {isOptimistic && " · sending..."}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </div>
              );
            })}
            <div ref={scrollToBottomOnRender} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-secondary/40 flex items-center justify-center mb-4 ring-1 ring-border/20">
              <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-base font-medium text-foreground mb-1.5">No messages yet</p>
            <p className="text-sm text-muted-foreground/60">Be the first to say something</p>
          </div>
        )}

        {/* Scroll to bottom FAB */}
        {showScrollBtn && (
          <div className="sticky bottom-4 flex justify-center z-10">
            <button
              onClick={scrollToBottom}
              className="h-11 w-11 rounded-full text-white shadow-lg flex items-center justify-center transition-all animate-fade-in hover:scale-110 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${currentPack.colors[0]}, ${currentPack.colors[2]})`,
                boxShadow: `0 10px 15px -3px ${currentPack.colors[0]}33`,
              }}
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}

      </div>

      {/* Message Input */}
      <div className="shrink-0 border-t border-border/50 bg-card/50 backdrop-blur-xl px-2 py-3">
        <div className="px-0">
          {imagePreviews.length > 0 && (
            <div className="flex gap-2.5 mb-3 overflow-x-auto pb-1">
              {imagePreviews.map((url, i) => (
                <div key={i} className="relative shrink-0">
                  <div className="h-16 w-16 rounded-xl overflow-hidden border border-border/50">
                    <img src={url} alt="attachment" className="h-full w-full object-cover" />
                  </div>
                  <button onClick={() => removeAttachment(i)} className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileAttach} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="shrink-0 h-10 w-10 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Paperclip className="h-4 w-4" />
            </button>
            <div className="relative">
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`shrink-0 h-10 w-10 rounded-xl transition-all flex items-center justify-center ${showEmojiPicker ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground"}`}>
                <Smile className="h-4 w-4" />
              </button>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full mb-3 left-0 z-20"
                >
                  <Picker
                    data={emojiData}
                    onEmojiSelect={(emoji: any) => handleEmojiSelect(emoji.native)}
                    theme={theme === "dark" ? "dark" : "light"}
                    previewPosition="none"
                    skinTonePosition="none"
                    set="native"
                    maxFrequentRows={2}
                  />
                </div>
              )}
            </div>
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                broadcastTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 bg-secondary/50 border-border/50 h-10 rounded-xl text-base placeholder:text-muted-foreground focus-visible:ring-ring/50"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() && fileAttachments.length === 0}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl text-white shadow-sm disabled:opacity-30 disabled:shadow-none transition-all"
              style={{
                background: `linear-gradient(135deg, ${currentPack.colors[0]}, ${currentPack.colors[2]})`,
                boxShadow: `0 4px 10px -3px ${currentPack.colors[0]}33`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${currentPack.colors[1]}, ${currentPack.colors[0]})`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${currentPack.colors[0]}, ${currentPack.colors[2]})`;
              }}
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
      </div>

      {/* Right: Room Info Panel */}
      <aside className="hidden lg:flex w-[340px] shrink-0 flex-col bg-card/40">
        {/* Animated Banner */}
        <div className="relative shrink-0 h-44 overflow-hidden">
          {groupPhoto ? (
            <img src={groupPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <div
            className={`absolute inset-0 ${groupPhoto ? "bg-gradient-to-t from-background/90 via-background/40 to-transparent" : "animate-gradient-shift"}`}
            style={groupPhoto ? undefined : {
              background: `linear-gradient(-45deg, ${currentPack.colors[0]}44, ${currentPack.colors[1]}33, ${currentPack.colors[2]}44, ${currentPack.colors[0]}55)`,
              backgroundSize: "400% 400%",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_20%,hsl(var(--background))_80%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,transparent_40%,hsl(var(--background))_70%)]" />
          <div className="absolute bottom-5 left-5 flex items-center gap-4">
            <div className="relative group/photo">
              <Avatar className="h-16 w-16 ring-[3px] ring-background shadow-2xl">
                {groupPhoto ? (
                  <AvatarImage src={groupPhoto} alt={roomName || ""} className="object-cover" />
                ) : (
                  <AvatarFallback className="text-xl font-bold accent-avatar-bg shadow-inner">
                    {(roomName || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                )}
              </Avatar>
              {userId === creatorId && (
                <>
                  <button
                    onClick={() => document.getElementById("group-photo-input")?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity"
                    title="Change group photo"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                  <input
                    id="group-photo-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGroupPhotoUpload}
                  />
                </>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-400 ring-[3px] ring-background animate-pulse-dot" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground drop-shadow-lg">{roomName}</h2>
              <p className="text-sm text-muted-foreground/90 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                {roomUsers.length} member{roomUsers.length !== 1 ? "s" : ""} · Active
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-6">
          {/* Description */}
          <div className="group/desc">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">About</p>
              {userId === creatorId && !editingDescription && (
                <button
                  onClick={() => { setDescriptionDraft(description); setEditingDescription(true); }}
                  className="h-6 w-6 rounded opacity-0 group-hover/desc:opacity-100 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {editingDescription ? (
              <div className="flex items-start gap-2">
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  className="flex-1 bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-ring/50 h-24"
                  placeholder="Add a description..."
                  autoFocus
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={handleSaveDescription}
                    className="h-8 w-8 rounded-lg bg-ring/20 flex items-center justify-center text-ring hover:bg-ring/30 transition-all"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingDescription(false)}
                    className="h-8 w-8 rounded-lg bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : description ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            ) : userId === creatorId ? (
              <button
                onClick={() => { setDescriptionDraft(""); setEditingDescription(true); }}
                className="text-sm text-muted-foreground/50 italic hover:text-muted-foreground transition-colors"
              >
                Add a description...
              </button>
            ) : null}
          </div>

          {/* Room Code — quick copy */}
          <div className="group relative">
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500"
              style={{ background: `linear-gradient(135deg, ${currentPack.colors[0]}44, ${currentPack.colors[2]}44)` }}
            />
            <div className="relative flex items-center gap-4 bg-secondary/40 rounded-xl p-4 border border-border/40 group-hover:border-ring/30 transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Invite Code</p>
                <div className="flex items-center gap-2">
                  <code className="text-base font-mono text-foreground tracking-[0.15em]">{roomCode}</code>
                  <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-mono">LIVE</span>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className="shrink-0 h-10 w-10 rounded-xl bg-background/70 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-ring/50 hover:bg-ring/10 transition-all active:scale-95"
              >
                {copyMessage ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Share */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Share2 className="h-4 w-4 text-muted-foreground" />
                Share
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {(() => {
                const descLine = description ? `\n"${description}"\n` : "\n";
                const rawShare = `Join me on ConnectTogether!${descLine}Room: ${roomName}\nCode: ${roomCode}\n\nConnect with anyone, anywhere.`;
                const shareUrl = typeof window !== "undefined" ? window.location.origin : "";
                const fullShare = `${rawShare}\n${shareUrl}`;
                return (
                  <>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(fullShare)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-border/30 bg-background/40 hover:bg-[#25D366]/10 hover:border-[#25D366]/30 transition-all group active:scale-95"
                    >
                      <svg className="h-6 w-6 text-muted-foreground group-hover:text-[#25D366] transition-colors" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      <span className="text-[10px] font-medium text-muted-foreground group-hover:text-[#25D366] transition-colors">WhatsApp</span>
                    </a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(`Join "${roomName}" on ConnectTogether`)}&body=${encodeURIComponent(rawShare + "\n\n" + shareUrl)}`}
                      className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-border/30 bg-background/40 hover:bg-[#EA4335]/10 hover:border-[#EA4335]/30 transition-all group active:scale-95"
                    >
                      <Mail className="h-6 w-6 text-muted-foreground group-hover:text-[#EA4335] transition-colors" />
                      <span className="text-[10px] font-medium text-muted-foreground group-hover:text-[#EA4335] transition-colors">Email</span>
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(fullShare);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      }}
                      className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-border/30 bg-background/40 hover:bg-ring/10 hover:border-ring/30 transition-all group active:scale-95"
                    >
                      {shareCopied ? (
                        <Check className="h-6 w-6 text-emerald-400" />
                      ) : (
                        <Copy className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                      <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {shareCopied ? "Copied!" : "Copy Link"}
                      </span>
                    </button>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Messages", value: messages.length, icon: MessageCircle },
              { label: "Members", value: roomUsers.length, icon: Users },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-4 text-center hover:bg-secondary/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-default">
                <p className="text-2xl font-bold accent-stat-grad leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
                  <stat.icon className="h-3.5 w-3.5" />
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Medias */}
          {(() => {
            const allImages: { url: string; sender: string; sent_at: string }[] = [];
            messages.forEach((msg: any) => {
              if (msg.images) {
                try {
                  const urls = JSON.parse(msg.images);
                  urls.forEach((url: string) => {
                    allImages.push({ url, sender: msg.user_id?.user_name || "Unknown", sent_at: msg.sent_at });
                  });
                } catch {}
              }
            });
            if (allImages.length === 0) return null;
            const showThree = allImages.slice(0, 3);
            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    Medias
                    <span className="text-muted-foreground font-normal text-xs">({allImages.length})</span>
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {showThree.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => { setMediaLightbox(allImages); setMediaLightboxIndex(i); }}
                      className="relative group/media overflow-hidden rounded-lg"
                    >
                      <img src={img.url} alt="" className="w-full aspect-square object-cover transition-transform duration-300 group-hover/media:scale-110" />
                      <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/20 transition-colors duration-300" />
                      {i === 2 && allImages.length > 3 && (
                        <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/80 flex items-center justify-center backdrop-blur-[2px]">
                          <span className="text-white text-lg font-bold tracking-tight">+{allImages.length - 3}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Media Lightbox */}
          {mediaLightbox && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setMediaLightbox(null)}>
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <div
                className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] flex flex-col animate-fade-in overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">{mediaLightbox[mediaLightboxIndex].sender}</h3>
                    <span className="text-xs text-muted-foreground/60">{mediaLightboxIndex + 1} / {mediaLightbox.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={mediaLightbox[mediaLightboxIndex].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 w-8 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                      title="Open in new tab"
                    >
                      <Expand className="h-4 w-4" />
                    </a>
                    <button onClick={() => setMediaLightbox(null)} className="h-8 w-8 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Image area */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black/40 p-4 min-h-0">
                  <button
                    onClick={() => setMediaLightboxIndex((mediaLightboxIndex - 1 + mediaLightbox.length) % mediaLightbox.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all z-10"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <img
                    src={mediaLightbox[mediaLightboxIndex].url}
                    alt=""
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                  <button
                    onClick={() => setMediaLightboxIndex((mediaLightboxIndex + 1) % mediaLightbox.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all z-10"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                {/* Thumbnails */}
                <div className="shrink-0 border-t border-border/50 px-4 py-3">
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar justify-center">
                    {mediaLightbox.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setMediaLightboxIndex(i)}
                        className={`shrink-0 h-12 w-12 rounded-lg overflow-hidden ring-2 transition-all ${
                          i === mediaLightboxIndex ? "ring-ring ring-offset-2 ring-offset-card" : "ring-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                Members
                <span className="text-muted-foreground font-normal text-xs">({roomUsers.length})</span>
              </h4>
            </div>
            <div className="space-y-1">
              {roomUsers.map((u: any) => {
                const isSelf = u.id === userId;
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 transition-all group cursor-pointer"
                    onClick={() => {
                      if (!isSelf) {
                        setActiveDmUser(u);
                      }
                    }}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10 ring-2 ring-border/50 group-hover:ring-ring/30 transition-all">
                        <AvatarImage src={u.profile_pic} alt={u.user_name} className="object-cover" />
                        <AvatarFallback className="text-xs accent-avatar-bg">
                          {getInitials(u.user_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card ${u.is_online ? "bg-emerald-400 animate-pulse-dot" : "bg-muted-foreground/40"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{u.user_name}</p>
                        {u.id === creatorId && (
                          <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">creator</span>
                        )}
                        {isSelf && u.id !== creatorId && (
                          <span className="text-[9px] font-semibold text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">you</span>
                        )}
                      </div>
                      <p className={`text-xs flex items-center gap-1 ${u.is_online ? "text-emerald-400/80" : "text-muted-foreground/60"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.is_online ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                        {typingUsers[u.id] ? (
                          <span className="text-ring animate-fade-in">typing<span className="inline-flex ml-0.5"><span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span><span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span><span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span></span></span>
                        ) : u.is_online ? "Online now" : "Offline"}
                      </p>
                      {u.bio && (
                        <p className="text-xs text-muted-foreground/60 truncate mt-0.5 leading-tight">{u.bio}</p>
                      )}
                    </div>
                    {!isSelf && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDmUser(u);
                        }}
                        className="shrink-0 h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 bg-background/80 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-ring/50 hover:bg-ring/10 transition-all active:scale-90"
                        title={`Message ${u.user_name}`}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {roomUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No members yet</p>
              )}
            </div>
          </div>

        </div>
      </aside>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowProfileModal(false)} />
          <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-[90vw] max-w-md animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <h3 className="text-base font-semibold text-foreground">My Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="h-8 w-8 rounded-lg hover:bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative group/pp">
                  <Avatar className="h-20 w-20 ring-2 ring-border/50">
                    {profilePic ? (
                      <AvatarImage src={profilePic} alt="" className="object-cover" />
                    ) : (
                      <AvatarFallback className="text-2xl font-bold accent-avatar-bg">
                        {roomUsers.find((u: any) => u.id === userId)?.user_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <button
                    onClick={() => document.getElementById("profile-pic-input-modal")?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover/pp:opacity-100 transition-opacity"
                    title="Change photo"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                  <input
                    id="profile-pic-input-modal"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfilePicUpload}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {editingDisplayName ? (
                    <div className="flex items-start gap-1.5">
                      <input
                        value={displayNameDraft}
                        onChange={(e) => setDisplayNameDraft(e.target.value)}
                        className="flex-1 bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-base text-foreground font-medium focus:outline-none focus:border-ring/50"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveDisplayName(); } }}
                      />
                      <button onClick={handleSaveDisplayName} className="h-8 w-8 rounded-lg bg-ring/20 flex items-center justify-center text-ring hover:bg-ring/30 transition-all shrink-0">
                        <CheckCheck className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingDisplayName(false)} className="h-8 w-8 rounded-lg bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-medium text-foreground truncate">
                        {roomUsers.find((u: any) => u.id === userId)?.user_name || "You"}
                      </p>
                      <button
                        onClick={() => { setDisplayNameDraft(roomUsers.find((u: any) => u.id === userId)?.user_name || ""); setEditingDisplayName(true); }}
                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground/70 flex items-center gap-1.5 mt-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Online now
                  </p>
                </div>
              </div>

              {/* Bio */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Bio</p>
                {editingBio ? (
                  <div className="flex items-start gap-1.5">
                    <input
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      className="flex-1 bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring/50"
                      placeholder="Write something about yourself..."
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveBio(); } }}
                    />
                    <button onClick={handleSaveBio} className="h-8 w-8 rounded-lg bg-ring/20 flex items-center justify-center text-ring hover:bg-ring/30 transition-all shrink-0">
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingBio(false)} className="h-8 w-8 rounded-lg bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : myBio ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground leading-relaxed">{myBio}</p>
                    <button
                      onClick={() => { setBioDraft(myBio); setEditingBio(true); }}
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setBioDraft(""); setEditingBio(true); }}
                    className="text-sm text-muted-foreground/50 italic hover:text-muted-foreground transition-colors"
                  >
                    Add a bio...
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Room Info Drawer */}
      {showMobileInfo && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileInfo(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-[380px] bg-card border-l border-border/50 shadow-2xl animate-fade-in flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest">Room Info</h3>
              <button onClick={() => setShowMobileInfo(false)} className="h-8 w-8 rounded-lg hover:bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-5">
              <div className="relative h-28 rounded-xl overflow-hidden">
                {groupPhoto ? <img src={groupPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                <div className={`absolute inset-0 ${groupPhoto ? "bg-gradient-to-t from-background/90 via-background/40 to-transparent" : "animate-gradient-shift"}`}
                  style={groupPhoto ? undefined : { background: `linear-gradient(-45deg, ${currentPack.colors[0]}44, ${currentPack.colors[1]}33, ${currentPack.colors[2]}44, ${currentPack.colors[0]}55)`, backgroundSize: "400% 400%" }}
                />
                <div className="absolute bottom-3 left-4 flex items-center gap-2.5">
                  <Avatar className="h-10 w-10 ring-2 ring-background shadow-lg">
                    {groupPhoto ? <AvatarImage src={groupPhoto} alt="" className="object-cover" /> : <AvatarFallback className="text-sm font-bold accent-avatar-bg">{(roomName || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback>}
                  </Avatar>
                  <div>
                    <h2 className="text-sm font-bold text-foreground drop-shadow">{roomName}</h2>
                    <p className="text-[10px] text-muted-foreground/90">{roomUsers.length} member{roomUsers.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
              {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
              <div className="flex items-center gap-2 bg-secondary/30 rounded-xl p-3 border border-border/30">
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Invite Code</p>
                  <code className="text-sm font-mono text-foreground tracking-wider">{roomCode}</code>
                </div>
                <button onClick={handleCopy} className="shrink-0 h-8 w-8 rounded-lg bg-background/70 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  {copyMessage ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div>
                <h4 className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  Members ({roomUsers.length})
                </h4>
                <div className="space-y-1">
                  {roomUsers.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-secondary/30 transition-all">
                      <div className="relative shrink-0">
                        <Avatar className="h-8 w-8 ring-2 ring-border/50">
                          <AvatarImage src={u.profile_pic} alt={u.user_name} className="object-cover" />
                          <AvatarFallback className="text-[9px] accent-avatar-bg">{getInitials(u.user_name || "?")}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-card ${u.is_online ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{u.user_name}</p>
                        <p className="text-[9px] text-muted-foreground/60">{u.is_online ? "Online" : "Offline"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      : (
        <div className="flex-1 flex flex-col min-w-0 items-center justify-center bg-background">
          <div className="text-center px-4">
            <div className="h-20 w-20 rounded-3xl bg-secondary/30 flex items-center justify-center mx-auto mb-4 ring-1 ring-border/20">
              <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Select a Group</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">Choose a group from the sidebar to start chatting, or create a new one</p>
            <a href="/join" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:scale-105 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${ACCENT_PACKS[0].colors[0]}, ${ACCENT_PACKS[0].colors[2]})` }}
            >
              Create or Join Group
            </a>
          </div>
        </div>
      )}

      {/* Floating DM panel */}
      {activeDmUser && (() => {
        const pos = dmPanelPos || { x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 400) : 800, y: typeof window !== 'undefined' ? Math.max(20, window.innerHeight - 520) : 200 };
        return (
          <div className="fixed z-50" style={{ left: pos.x, top: pos.y }}>
            <FloatingDmPanel
              targetUser={activeDmUser}
              onClose={() => { setActiveDmUser(null); setDmPanelPos(null); }}
              onDrag={(dx, dy) => {
                setDmPanelPos((prev) => ({
                  x: (prev?.x || pos.x) + dx,
                  y: (prev?.y || pos.y) + dy,
                }));
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}

export default function AboutPageWrapper() {
  const router = useRouter();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [accentPack, setAccentPack] = useState("default");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("accent-pack");
      if (stored) setAccentPack(stored);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accentPack);
    try { localStorage.setItem("accent-pack", accentPack); } catch {}
  }, [accentPack]);

  const handleExit = () => {
    localStorage.removeItem("last-username");
    router.push("/");
  };

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="h-8 w-8 border-2 border-ring/30 border-t-ring rounded-full animate-spin" />
        </div>
      }
    >
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        <header className="h-12 bg-background/80 backdrop-blur-xl border-b border-border/30 text-foreground px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center">
              <MessageCircle className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-wide">Connect Together</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
              {ACCENT_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => setAccentPack(pack.id)}
                  className={`h-6 w-6 rounded-full border-2 transition-all duration-200 hover:scale-125 active:scale-95 ${
                    accentPack === pack.id
                      ? "border-white scale-110 shadow-lg shadow-white/20"
                      : "border-transparent hover:border-white/50"
                  }`}
                  title={pack.name}
                  style={{ background: `linear-gradient(135deg, ${pack.colors[0]}, ${pack.colors[2]})` }}
                />
              ))}
            </div>
            <button onClick={() => setShowProfileModal(true)} className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors" title="My Profile">
              <User className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleExit} className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors" title="Logout">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            <ChatRoom showProfileModal={showProfileModal} setShowProfileModal={setShowProfileModal} accentPack={accentPack} setAccentPack={setAccentPack} />
          </div>
        </div>
      </div>
    </Suspense>
  );
}
