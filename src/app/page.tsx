"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { FiCopy } from "react-icons/fi";
import CryptoJS from "crypto-js";
import { Label } from "@radix-ui/react-label";

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
  const secretKey = "key";
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Handle room creation
  const uploadPhoto = async () => {
    if (!file) {
      alert("Please select a file first.");
      return null; // Return null if no file is uploaded
    }

    try {
      setUploading(true);

      // Generate a unique file name
      const fileName = `avatar-${Date.now()}-${file.name}`;

      // Upload the file to the "avatars" bucket
      const { data: uploadData, error: uploadError } =
        await supabaseBrowserClient.storage
          .from("avatars")
          .upload(fileName, file, {
            cacheControl: "3600", // Cache for 1 hour
            upsert: false, // Avoid overwriting
          });

      if (uploadError) {
        console.error("Error uploading file:", uploadError.message);
        alert("Error uploading file!");
        return null;
      }

      // Get the public URL for the uploaded file
      const {
        data: { publicUrl },
      } = supabaseBrowserClient.storage.from("avatars").getPublicUrl(fileName);

      console.log("File uploaded successfully:", publicUrl);
      return publicUrl;
    } catch (error) {
      console.error("Error during file upload:", error);
      return null;
    } finally {
      setUploading(false);
      setFile(null); // Reset the file input
    }
  };

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

  const handleEnterRoom = async () => {
    setIsLoadingEnter(true);
    setError(null);

    if (!roomCode || !personName) {
      setError("Please provide a room code and your name.");
      setIsLoadingEnter(false);
      return;
    }

    // Check if a photo is uploaded and get its public URL if provided
    let publicUrl = null;
    if (file) {
      publicUrl = await uploadPhoto();
      if (!publicUrl) {
        setError("Failed to upload photo. Please try again.");
        setIsLoadingEnter(false);
        return;
      }
    }

    // Check if the room exists
    const { data, error } = await supabaseBrowserClient
      .from("rooms")
      .select("id, room_code, room_name")
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
                profile_pic: publicUrl, // This will be null if no photo is uploaded
              },
            ],
            { onConflict: "room_id, user_name" }
          )
          .select("id");

      if (insertError) {
        setError(insertError.message);
      } else {
        const userId = insertedData[0].id;
        const roomId = data.id;
        const roomName = data.room_name;
        const roomCode = data.room_code;
        const roomIdStr = String(roomId);
        const userIdStr = String(userId);

        const encryptedRoomId = CryptoJS.AES.encrypt(
          roomIdStr,
          secretKey
        ).toString();
        const encryptedUserId = CryptoJS.AES.encrypt(
          userIdStr,
          secretKey
        ).toString();
        const encryptedRoomName = CryptoJS.AES.encrypt(
          roomName,
          secretKey
        ).toString();
        const encryptedRoomCode = CryptoJS.AES.encrypt(
          roomCode,
          secretKey
        ).toString();

        // Navigate with encrypted parameters
        router.push(
          `/chatRoom?roomId=${encodeURIComponent(
            encryptedRoomId
          )}&userId=${encodeURIComponent(
            encryptedUserId
          )}&roomName=${encodeURIComponent(
            encryptedRoomName
          )}&roomCode=${encodeURIComponent(encryptedRoomCode)}`
        );
      }
    }

    setIsLoadingEnter(false);
  };

  // Generate a unique room code (you can customize this as needed)
  const generateUniqueCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
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

  const handleFileChange = (event: any) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center p-12 bg-black h-[100vh] overflow-y-auto custom-scrollbar">
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
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Input
              id="picture"
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              className="mb-6 border-2 border-purple-500 w-full placeholder-purple-400  rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-white"
            />
          </div>

          <Button
            onClick={handleEnterRoom}
            disabled={isLoadingEnter}
            className={`w-full p-4 text-white h-12 rounded-xl font-semibold transform transition-all duration-300 hover:scale-105 ${
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
