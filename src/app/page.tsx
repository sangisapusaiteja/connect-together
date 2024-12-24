"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { ParamsStore } from "@zustandstore/redux";
import { FiCopy } from "react-icons/fi";

export default function IndexPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");
  const [personName, setPersonName] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCreate, setIsLoadingCreate] = useState<boolean>(false);
  const [isLoadingEnter, setIsLoadingEnter] = useState<boolean>(false);
  const [copyMessage, setCopyMessage] = useState("");

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

  const handleCopy = () => {
    const roomCode = generatedCode;
    if (roomCode) {
      navigator.clipboard
        .writeText(roomCode)
        .then(() => {
          setCopyMessage("Copied!");
          setTimeout(() => {
            setCopyMessage(""); // Clear the message after 2 seconds
          }, 2000);
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
        });
    }
  };
  return (
    <div className="flex flex-col justify-center items-center p-12 bg-black min-h-screen">
      <div className="flex flex-wrap justify-center gap-16 w-full max-w-6xl">
        {/* Create Room Card */}
        <div className="w-full sm:w-1/2 lg:w-1/3 border border-purple-500 p-8 rounded-3xl shadow-3xl flex flex-col items-center justify-center ">
          <h2 className="text-4xl font-extrabold mb-6 text-white drop-shadow-lg">
            Create a Room
          </h2>
          <Input
            type="text"
            placeholder="Room Name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="mb-6 p-4 border-2 border-purple-500 w-full  placeholder-purple-400  rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-white"
          />

          <Button
            onClick={handleCreateRoom}
            disabled={isLoadingCreate}
            className={`w-full p-4 text-white h-12 rounded-xl font-semibold  transform transition-all duration-300 hover:scale-105  ${
              isLoadingCreate
                ? "bg-purple-400 cursor-not-allowed"
                : "bg-purple-700 hover:bg-purple-800"
            }`}
          >
            {isLoadingCreate ? "Creating..." : "Generate Room"}
          </Button>

          {generatedCode && (
            <div className="mt-6 p-4 rounded-lg shadow-inner bg-black">
              <p className="text-purple-800 font-semibold flex items-center gap-2">
                Room created! Code:{" "}
                <strong className="text-green-600">{generatedCode}</strong>
                {copyMessage ? (
                  <span className="text-green-500 text-sm">{copyMessage}</span>
                ) : (
                  <button
                    onClick={handleCopy}
                    className="text-blue-500 hover:text-blue-700 transition-colors flex items-center"
                  >
                    <FiCopy className="h-4 w-4 text-purple-600" />
                  </button>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-full flex items-center justify-center">
          <div className="border-t border-purple-500 w-1/6"></div>
          <span className="mx-4 text-white font-semibold">OR</span>
          <div className="border-t border-purple-500 w-1/6"></div>
        </div>

        {/* Enter Room Card */}
        <div className="w-full sm:w-1/2 lg:w-1/3 border border-purple-500 p-8 rounded-3xl shadow-3xl flex flex-col items-center justify-center">
          <h2 className="text-4xl font-extrabold mb-6 text-white drop-shadow-lg">
            Enter a Room
          </h2>
          <Input
            type="text"
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="mb-6 p-4 border-2 border-purple-500 w-full placeholder-purple-400  rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-white"
          />
          <Input
            type="text"
            placeholder="Your Name"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            className="mb-6 p-4 border-2 border-purple-500 w-full placeholder-purple-400  rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-white"
          />
          <Button
            onClick={handleEnterRoom}
            disabled={isLoadingEnter}
            className={`w-full p-4 text-white h-12 rounded-xl font-semibold   transform transition-all duration-300 hover:scale-105  ${
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
