"use client";

import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Suspense, useEffect, useRef, useState } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { FiCopy } from "react-icons/fi";
import { PersonalChatRoomPage } from "@app/components/personalChatRoom";
import CryptoJS from "crypto-js";
import { useSearchParams } from "next/navigation";
import { useParamsStore } from "@zustandstore/redux";

function ChatRoom() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [copyMessage, setCopyMessage] = useState("");
  const secretKey = "key"; // Same key used for encryption

  const searchParams = useSearchParams();
  const encryptedRoomId = searchParams.get("roomId");
  const encryptedUserId = searchParams.get("userId");
  const encryptedRoomName = searchParams.get("roomName");
  const encryptedRoomCode = searchParams.get("roomCode");

  const [roomId, setRoomId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const setMessageLength = useParamsStore((state) => state.setMessageLength);

  useEffect(() => {
    if (encryptedRoomId && encryptedUserId) {
      try {
        // Decrypt the parameters
        const decryptedRoomIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomId),
          secretKey
        );
        const decryptedUserIdBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedUserId),
          secretKey
        );

        const decryptedRoomNameBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomName ?? ""),
          secretKey
        );

        const decryptedRoomCodeBytes = CryptoJS.AES.decrypt(
          decodeURIComponent(encryptedRoomCode ?? ""),
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

        const decryptedRoomName = decryptedRoomNameBytes.toString(
          CryptoJS.enc.Utf8
        );

        const decryptedRoomCode = decryptedRoomCodeBytes.toString(
          CryptoJS.enc.Utf8
        );
        // Ensure they are valid numbers
        if (isNaN(decryptedRoomId) || isNaN(decryptedUserId)) {
          throw new Error("Decryption resulted in invalid numbers");
        }

        setRoomId(decryptedRoomId);
        setUserId(decryptedUserId);
        setRoomName(decryptedRoomName);
        setRoomCode(decryptedRoomCode);
      } catch (e) {
        console.error("Decryption error:", e);
        setError("Decryption error occurred");
      }
    }
  }, [encryptedRoomId, encryptedUserId]);
  // Fetch messages from the room when the component loads
  useEffect(() => {
    if (roomId === null) return; // Wait until roomId is resolved

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabaseBrowserClient
          .from("messages")
          .select(
            "message, sent_at, user_id(id, user_name), room_id(id, room_name, room_code)"
          )
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });

        if (error) {
          console.error("Error fetching messages:", error);
          setError(error.message);
        } else {
          setMessageLength(data.length);
          setMessages(data);
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
        setError("Something went wrong");
      }
    };

    fetchMessages();

    // Real-time subscription to listen for new messages
    const messageSubscription = supabaseBrowserClient
      .channel(`room:${roomId}`) // Create a channel for the room
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          fetchMessages();
        }
      )
      .subscribe();

    // Cleanup subscription when roomId changes or component unmounts
    return () => {
      supabaseBrowserClient.removeChannel(messageSubscription);
    };
  }, [roomId]);

  // Send a new message to the room
  const handleSendMessage = async () => {
    if (!roomId || !newMessage || !userId) return;

    // Insert the message into the messages table
    const { error } = await supabaseBrowserClient
      .from("messages")
      .insert([{ room_id: roomId, user_id: userId, message: newMessage }]);

    if (error) {
      setError("Failed to send message.");
    } else {
      setNewMessage(""); // Clear the input field
    }
  };

  // Inside your component
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom without smooth scroll
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" }); // Instantly scroll to the bottom
    }
  }, [messages]);

  const handleCopy = () => {
    const roomCode = messages?.[0]?.room_id?.room_code;
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
    <div className=" bg-black h-[100vh] flex flex-col w-full border-l-2 border-b-2 border-purple-600">
      {/* Header */}
      <div className="sticky top-0 z-20  py-4 border-b-2 border-t-2 border-purple-600">
        <h1 className="text-4xl font-extrabold  text-purple-600 flex items-center justify-between px-6 h-[80px]">
          <div className="flex items-center flex-col gap-1">
            <span>Room Name:</span>
            <span>
              <i className="font-bold text-3xl">"&nbsp;{roomName}&nbsp;"</i>
            </span>
          </div>
          <div className="flex items-center space-x-4  gap-1">
            {copyMessage && (
              <span className="text-green-500 text-sm">{copyMessage}</span>
            )}
            <div className="gap-2 flex border-2 border-purple-600 rounded-3xl items-center px-4 py-3">
              <span className="text-lg">{roomCode}</span>

              <button
                onClick={handleCopy}
                className="text-blue-500 hover:text-blue-700 transition-colors"
              >
                <FiCopy className="h-5 w-5 text-purple-600" />
              </button>
            </div>
          </div>
        </h1>
      </div>

      {/* Displaying error if any */}
      {error && (
        <p className="text-red-500 mb-6 text-center font-semibold text-lg">
          {error}
        </p>
      )}

      {/* Displaying messages */}
      <div className="overflow-y-auto flex-1 pt-[90px] pb-20 px-6 custom-scrollbar">
        {messages.length > 0 ? (
          <ul className="space-y-5">
            {messages.map((message, index) => {
              const isCurrentUser = message.user_id?.id === userId;
              return (
                <li
                  key={index}
                  className={`flex ${
                    isCurrentUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex flex-col max-w-lg ${
                      isCurrentUser ? "items-end" : "items-start"
                    }`}
                  >
                    <span
                      className={`px-4 py-2 rounded-tl-3xl rounded-tr-3xl ${
                        isCurrentUser
                          ? "rounded-bl-3xl bg-purple-800 text-white text-xl border-2  border-white font-semibold"
                          : "rounded-br-3xl bg-white text-black text-xl border-[3px] border-purple-600 font-semibold"
                      } break-all`}
                    >
                      {message.message}
                      <p
                        className={`text-xs  mt-1 ${
                          isCurrentUser
                            ? "text-right text-white"
                            : "text-left text-black"
                        }`}
                      >
                        {new Date(message.sent_at).toLocaleString()}
                      </p>
                    </span>
                    <span className="font-semibold text-white mt-2 text-lg">
                      {message.user_id?.user_name}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-white text-center mt-10 font-medium">
            No messages in this room yet.
          </p>
        )}
        {/* Scroll reference at the end of messages */}
        <div ref={messagesEndRef} />
      </div>

      {/* Form to send new message */}
      <div className=" flex items-center space-x-4 sticky bottom-0 py-4 px-6 z-30 shadow-md bg-black">
        <Input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type to Connect 😊..."
          className="p-3 w-full h-[40px] max-w-full text-lg text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300 ease-in-out transform hover:scale-103 border-2 border-purple-600"
        />

        <Button
          onClick={handleSendMessage}
          className="p-2 bg-transparent text-white hover:bg-transparent transition duration-200 transform hover:scale-110 flex items-center justify-center shadow-none"
        >
          <PaperAirplaneIcon className="!h-12 !w-12 text-purple-500" />{" "}
          {/* Send Icon */}
        </Button>
      </div>
    </div>
  );
}
export default function AboutPageWrapper() {
  // Redirect if roomId or userId is missing
  const messageLength = useParamsStore((state) => state.messageLength);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex  h-screen  w-full">
        <ChatRoom />
        {messageLength > 0 && <PersonalChatRoomPage />}
      </div>
    </Suspense>
  );
}
