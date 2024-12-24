"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { ParamsStore } from "@zustandstore/redux";

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
  const { setParamsData } = ParamsStore();

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
      // Insert the user into the users table
      const { data: insertedData, error: insertError } =
        await supabaseBrowserClient
          .from("users")
          .upsert(
            [
              {
                room_id: data.id,
                user_name: personName,
              },
            ],
            { onConflict: "room_id, user_name" }
          )
          .select("id");

      if (insertError) {
        setError(insertError.message);
      } else {
        // Get the inserted user's id
        const userId = insertedData[0].id;
        setParamsData({ roomId: data.id, userId });
        // Navigate to the About page with the inserted user's id
        router.push(`/chatRoom`);
      }
    }

    setIsLoadingEnter(false);
  };

  return (
    <div className="flex flex-col justify-center items-center p-12 bg-gradient-to-br from-purple-700 via-purple-800 to-purple-900 min-h-screen">
      <div className="flex flex-wrap justify-center gap-16 w-full max-w-6xl">
        {/* Create Room Card */}
        <div className="w-full sm:w-1/2 lg:w-1/3 bg-gradient-to-b from-purple-600 via-purple-700 to-purple-800 p-8 rounded-3xl shadow-3xl flex flex-col items-center justify-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
          <h2 className="text-4xl font-extrabold mb-6 text-white drop-shadow-lg">
            Create a Room
          </h2>
          <Input
            type="text"
            placeholder="Room Name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="mb-6 p-4 border-2 border-purple-500 w-full text-black placeholder-purple-400 bg-white rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />

          <Button
            onClick={handleCreateRoom}
            disabled={isLoadingCreate}
            className={`w-full p-4 text-white h-12 rounded-xl font-semibold transition-colors duration-300 ${
              isLoadingCreate
                ? "bg-purple-400 cursor-not-allowed"
                : "bg-purple-700 hover:bg-purple-800"
            }`}
          >
            {isLoadingCreate ? "Creating..." : "Generate Room"}
          </Button>

          {generatedCode && (
            <div className="mt-6 p-4 bg-purple-50 rounded-lg shadow-inner">
              <p className="text-purple-800 font-semibold">
                Room created! Code:{" "}
                <strong className="text-purple-600">{generatedCode}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Enter Room Card */}
        <div className="w-full sm:w-1/2 lg:w-1/3 bg-gradient-to-b from-purple-600 via-purple-700 to-purple-800 p-8 rounded-3xl shadow-3xl flex flex-col items-center justify-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
          <h2 className="text-4xl font-extrabold mb-6 text-white drop-shadow-lg">
            Enter a Room
          </h2>
          <Input
            type="text"
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="mb-6 p-4 border-2 border-purple-500 w-full text-black placeholder-purple-400 bg-white rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <Input
            type="text"
            placeholder="Your Name"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            className="mb-6 p-4 border-2 border-purple-500 w-full text-black placeholder-purple-400 bg-white rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <Button
            onClick={handleEnterRoom}
            disabled={isLoadingEnter}
            className={`w-full p-4 text-white h-12 rounded-xl font-semibold transition-colors duration-300 ${
              isLoadingEnter
                ? "bg-purple-400 cursor-not-allowed"
                : "bg-purple-700 hover:bg-purple-800"
            }`}
          >
            {isLoadingEnter ? "Joining..." : "Enter Room"}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-8 max-w-4xl w-full text-center">
          <p className="text-xl text-red-500 font-semibold">{error}</p>
        </div>
      )}
    </div>
  );
}
