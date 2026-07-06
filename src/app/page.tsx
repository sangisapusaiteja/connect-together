"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@*/components/ui/card";
import { Separator } from "@*/components/ui/separator";
import { Badge } from "@*/components/ui/badge";
import { Label } from "@radix-ui/react-label";
import { Copy, Check, Plus, LogIn, Upload, MessageCircle, Users, Zap, X, ArrowRight, LogOut } from "lucide-react";
import CryptoJS from "crypto-js";

const secretKey = "key";

export default function IndexPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"groups" | "join" | "create">("groups");

  // My Groups
  const [loginUsername, setLoginUsername] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Join Room
  const [roomCode, setRoomCode] = useState("");
  const [personName, setPersonName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isLoadingEnter, setIsLoadingEnter] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Create Room
  const [roomName, setRoomName] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isLoadingCreate, setIsLoadingCreate] = useState(false);
  const [copyMessage, setCopyMessage] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("last-username");
      if (stored) { setLoginUsername(stored); setUsername(stored); }
    } catch {}
  }, []);

  const uploadPhoto = async () => {
    if (!file) return null;
    try {
      setUploading(true);
      const fileName = `avatar-${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabaseBrowserClient.storage.from("avatars").upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (uploadError) return null;
      const { data: { publicUrl } } = supabaseBrowserClient.storage.from("avatars").getPublicUrl(fileName);
      return publicUrl;
    } catch { return null; } finally { setUploading(false); setFile(null); }
  };

  const handleLogin = async () => {
    if (!loginUsername.trim()) { setLoginError("Enter your username."); return; }
    setLoginLoading(true); setLoginError(null);
    const { data: existing } = await supabaseBrowserClient.from("users").select("id").eq("username", loginUsername.trim()).maybeSingle();
    if (!existing) { setLoginError("Username not found. Join a room first."); setLoginLoading(false); return; }
    try { localStorage.setItem("last-username", loginUsername.trim()); } catch {}
    router.push("/groups");
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) { setError("Please enter a room name."); return; }
    setIsLoadingCreate(true); setError(null);
    const { data: existingRoom } = await supabaseBrowserClient.from("rooms").select("room_name").eq("room_name", roomName).single();
    if (existingRoom && existingRoom.room_name) { setError("Room name already exists."); setIsLoadingCreate(false); return; }
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    const { error: createError } = await supabaseBrowserClient.from("rooms").insert([{ room_name: roomName, room_code: code }]);
    if (createError) setError(createError.message);
    else setGeneratedCode(code);
    setIsLoadingCreate(false);
  };

  const checkUsername = async () => {
    if (!username.trim() || !roomCode) { setError("Enter a room code and username first."); return; }
    setCheckingUsername(true); setError(null);
    const { data: room } = await supabaseBrowserClient.from("rooms").select("id").eq("room_code", roomCode).single();
    if (!room) { setError("Invalid room code."); setCheckingUsername(false); return; }
    const { data: existing } = await supabaseBrowserClient.from("users").select("id, user_name").eq("room_id", room.id).eq("username", username.trim()).maybeSingle();
    if (existing) { setIsExistingUser(true); setPersonName(existing.user_name || ""); }
    else { setIsExistingUser(false); setPersonName(""); }
    setUsernameAvailable(true); setUsernameChecked(true); setError(null); setCheckingUsername(false);
  };

  const handleEnterRoom = async () => {
    setIsLoadingEnter(true); setError(null);
    if (!roomCode || !username) { setError("Please provide a room code and username."); setIsLoadingEnter(false); return; }
    if (!usernameChecked || usernameAvailable !== true) { setError("Please check if your username is available first."); setIsLoadingEnter(false); return; }
    if (!isExistingUser && !personName.trim()) { setError("Display name is required for new users."); setIsLoadingEnter(false); return; }
    let publicUrl = null;
    if (file) { publicUrl = await uploadPhoto(); if (!publicUrl) { setError("Failed to upload photo."); setIsLoadingEnter(false); return; } }
    const { data, error } = await supabaseBrowserClient.from("rooms").select("id, room_code, room_name").eq("room_code", roomCode).single();
    if (error || !data) { setError("Invalid room code."); }
    else {
      const userData: { room_id: any; user_name?: string; username: string; profile_pic?: string } = { room_id: data.id, username };
      if (personName.trim()) userData.user_name = personName.trim();
      if (publicUrl) userData.profile_pic = publicUrl;
      const { data: insertedData, error: insertError } = await supabaseBrowserClient.from("users").upsert([userData], { onConflict: "room_id, username" }).select("id");
      if (insertError) { setError(insertError.message); }
      else {
        const userId = insertedData[0].id;
        await supabaseBrowserClient.from("rooms").update({ created_by: userId }).eq("id", data.id).is("created_by", null);
        try { localStorage.setItem("last-username", username); } catch {}
        const encryptedRoomId = CryptoJS.AES.encrypt(String(data.id), secretKey).toString();
        const encryptedUserId = CryptoJS.AES.encrypt(String(userId), secretKey).toString();
        const encryptedRoomName = CryptoJS.AES.encrypt(data.room_name, secretKey).toString();
        const encryptedRoomCode = CryptoJS.AES.encrypt(data.room_code, secretKey).toString();
        router.push(`/chatRoom?roomId=${encodeURIComponent(encryptedRoomId)}&userId=${encodeURIComponent(encryptedUserId)}&roomName=${encodeURIComponent(encryptedRoomName)}&roomCode=${encodeURIComponent(encryptedRoomCode)}`);
      }
    }
    setIsLoadingEnter(false);
  };

  const handleCopy = () => {
    if (generatedCode) { navigator.clipboard.writeText(generatedCode).then(() => { setCopyMessage(true); setTimeout(() => setCopyMessage(false), 2000); }); }
  };

  const handleFileChange = (event: any) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) { setFile(selectedFile); setPreviewUrl(URL.createObjectURL(selectedFile)); }
  };

  const clearPreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setFile(null); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Connect Together</h1>
          </div>
          <Badge variant="secondary" className="text-xs font-medium gap-1.5 hidden sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            Real-time
          </Badge>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              <span className="gradient-text">Chat in real-time</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">Connect with anyone, anywhere.</p>
          </div>

          <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 mb-6">
            <button onClick={() => { setActiveTab("groups"); setError(null); setLoginError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === "groups" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <MessageCircle className="h-4 w-4" />
              My Groups
            </button>
            <button onClick={() => { setActiveTab("join"); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === "join" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <LogIn className="h-4 w-4" />
              Join Room
            </button>
            <button onClick={() => { setActiveTab("create"); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === "create" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Plus className="h-4 w-4" />
              Create Room
            </button>
          </div>

          {/* My Groups */}
          {activeTab === "groups" && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">My Groups</CardTitle>
                <CardDescription>Enter your username to see your groups</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Username</Label>
                  <Input
                    type="text"
                    placeholder="Your username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                    className="bg-background/50 border-border/50 h-11 text-sm font-mono"
                    autoFocus
                  />
                </div>
                <Button
                  onClick={handleLogin}
                  disabled={loginLoading || !loginUsername.trim()}
                  className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium shadow-lg shadow-purple-500/20 transition-all"
                >
                  {loginLoading ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Continue
                    </span>
                  )}
                </Button>
                {loginError && (
                  <p className="text-xs text-red-400 text-center">{loginError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Join Room */}
          {activeTab === "join" && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Join a Room</CardTitle>
                <CardDescription>Enter the room code shared with you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Room Code</Label>
                  <Input
                    type="text"
                    placeholder="e.g. ABC123"
                    value={roomCode}
                    onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setUsernameChecked(false); setUsernameAvailable(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEnterRoom(); }}
                    className="bg-background/50 border-border/50 h-11 text-sm tracking-widest font-mono uppercase placeholder:tracking-normal placeholder:font-sans placeholder:normal-case"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Username</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Unique login ID"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setUsernameChecked(false); setUsernameAvailable(null); }}
                      className="flex-1 bg-background/50 border-border/50 h-11 text-sm font-mono"
                    />
                    <Button onClick={checkUsername} disabled={checkingUsername || !username.trim()} variant="outline" className="shrink-0 h-11 px-4 border-border/50">
                      {checkingUsername ? (
                        <span className="h-4 w-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                      ) : usernameChecked && usernameAvailable ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-xs">Check</span>
                      )}
                    </Button>
                  </div>
                  {usernameChecked && usernameAvailable && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Username available</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Display Name
                    {!isExistingUser && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Input
                    type="text"
                    placeholder={isExistingUser ? "Leave blank to keep current name" : "What should we call you?"}
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEnterRoom(); }}
                    className="bg-background/50 border-border/50 h-11 text-sm"
                  />
                  {isExistingUser && (
                    <p className="text-[10px] text-muted-foreground/60">Leave empty to keep your existing display name</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Profile Picture <span className="text-xs">(optional)</span>
                  </Label>
                  <div className="flex items-center gap-3">
                    {previewUrl ? (
                      <div className="relative shrink-0">
                        <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-purple-500/30">
                          <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                        </div>
                        <button type="button" onClick={clearPreview} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                    <Input id="picture" type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="bg-background/50 border-border/50 h-11 text-sm file:text-muted-foreground file:text-xs file:mr-3 cursor-pointer" />
                  </div>
                </div>
                <Button onClick={handleEnterRoom} disabled={isLoadingEnter} className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium shadow-lg shadow-purple-500/20 transition-all">
                  {isLoadingEnter ? (
                    <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Joining...</span>
                  ) : (
                    <span className="flex items-center gap-2"><LogIn className="h-4 w-4" /> Join Room</span>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Create Room */}
          {activeTab === "create" && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Create a Room</CardTitle>
                <CardDescription>Start a new chat room and invite others</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Room Name</Label>
                  <Input
                    type="text"
                    placeholder="Give your room a name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoom(); }}
                    className="bg-background/50 border-border/50 h-11 text-sm"
                  />
                </div>
                <Button onClick={handleCreateRoom} disabled={isLoadingCreate} className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium shadow-lg shadow-purple-500/20 transition-all">
                  {isLoadingCreate ? (
                    <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Create Room</span>
                  )}
                </Button>
                {generatedCode && (
                  <div className="mt-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                    <p className="text-sm text-emerald-400 font-medium mb-2">Room created successfully!</p>
                    <div className="flex items-center justify-between bg-background/60 rounded-lg px-4 py-3">
                      <span className="font-mono text-lg font-bold tracking-[0.2em] text-foreground">{generatedCode}</span>
                      <button onClick={handleCopy} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {copyMessage ? <><Check className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">Copied!</span></> : <><Copy className="h-4 w-4" /><span>Copy</span></>}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Share this code with others to join your room.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 animate-fade-in">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 mt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-purple-400" /> Instant</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-400" /> Group Chat</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> Private DMs</span>
          </div>
        </div>
      </main>
    </div>
  );
}
