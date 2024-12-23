"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";

export default function IndexPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");
  const [personName, setPersonName] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCreate, setIsLoadingCreate] = useState<boolean>(false);
  const [isLoadingEnter, setIsLoadingEnter] = useState<boolean>(false);

  // Handle room creation
  const handleCreateRoom = async () => {
    setIsLoadingCreate(true);
    setError(null);

    // Check if room name already exists
    const { data: existingRoom, error: checkError } =
      await supabaseBrowserClient
        .from("rooms")
        .select("room_name")
        .eq("room_name", roomName)
        .single();

    if (checkError && checkError.code !== "PGRST116") {
      setError("An error occurred while checking the room name.");
      setIsLoadingCreate(false);
      return;
    }

    if (existingRoom) {
      setError("Room name already exists. Please choose another name.");
      setIsLoadingCreate(false);
      return;
    }

    // Create room
    const code = generateUniqueCode();
    const { error: createError } = await supabaseBrowserClient
      .from("rooms")
      .insert([{ room_name: roomName, room_code: code }]);

    if (createError) {
      setError(createError.message);
    } else {
      setGeneratedCode(code); // Display the generated code
    }

    setIsLoadingCreate(false);
  };

  // Generate a unique room code (you can customize this as needed)
  const generateUniqueCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  // Handle entering a room
  const handleEnterRoom = async () => {
    setIsLoadingEnter(true);
    setError(null);
  
    if (!roomCode || !personName) {
      setError("Please provide a room code and your name.");
      setIsLoadingEnter(false);
      return;
    }
  
    // Check if the room exists
    const { data, error } = await supabaseBrowserClient
      .from("rooms")
      .select("id, room_code")
      .eq("room_code", roomCode)
      .single();
  
    if (error || !data) {
      setError("Invalid room code. Please try again.");
    } else {
      // Store the room id and person name in local storage or pass via router
      localStorage.setItem("roomId", data.id.toString());
      localStorage.setItem("personName", personName);
  
      // Insert the user into the users table
      const { error: insertError } = await supabaseBrowserClient
        .from("users")
        .insert([
          {
            room_id: data.id,
            user_name: personName,
          }
        ]);
  
      if (insertError) {
        setError("Failed to add user to the room.");
      } else {
        // Navigate to the About page
        router.push("/about");
      }
    }
  
    setIsLoadingEnter(false);
  };
  
  

  return (
    <div className="flex flex-col justify-center items-center p-6 bg-black min-h-screen">
      <div className="flex space-x-10 w-[80%]">
        <div className="w-1/2 bg-purple-700 p-6 rounded-2xl shadow-lg h-[500px] flex flex-col items-center justify-center">
          <h2 className="text-3xl font-semibold mb-4 text-white">
            Create a Room
          </h2>
          <Input
            type="text"
            placeholder="Room Name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="mb-4 p-3 border border-purple-400  w-full text-black placeholder-white bg-white h-[40px] rounded-xl"
          />

          <Button
            onClick={handleCreateRoom}
            disabled={isLoadingCreate}
            className={`p-3  text-white h-10 rounded-xl ${
              isLoadingCreate ? "bg-purple-500 cursor-not-allowed" : "bg-black "
            }`}
          >
            {isLoadingCreate ? "Loading..." : "Generate Room"}
          </Button>

          {generatedCode && (
            <div className="mt-4">
              <p className="text-white">
                Room created! Code: <strong>{generatedCode}</strong>
              </p>
            </div>
          )}
        </div>

        <div className="w-1/2 bg-purple-700 p-6 rounded-2xl shadow-lg h-[500px] flex flex-col items-center justify-center">
          <h2 className="text-3xl font-semibold mb-4 text-white">
            Enter a Room
          </h2>
          <Input
            type="text"
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="mb-4 p-3 border border-purple-400  w-full text-black bg-white h-[40px] rounded-xl"
          />
          <Input
            type="text"
            placeholder="Your Name"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            className="mb-4 p-3 border border-purple-400  w-full text-black bg-white h-[40px] rounded-xl"
          />
          <Button
            onClick={handleEnterRoom}
            disabled={isLoadingEnter}
            className={`p-3  text-white h-10 rounded-xl ${
              isLoadingCreate ? "bg-purple-500 cursor-not-allowed" : "bg-black "
            }`}
          >
            {isLoadingEnter ? "Loading..." : "Enter Room"}
          </Button>
        </div>
      </div>
      <div>
        {error && (
          <p className="text-red-500 mt-4 text-center font-bold">{error}</p>
        )}
      </div>
    </div>
  );
}
