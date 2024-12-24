"use client";

import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Suspense, useEffect, useRef, useState } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline"; // Heroicons import
import { ParamsStore } from "@zustandstore/redux";

function AboutPage() {
  const { paramsData } = ParamsStore();
  const roomId = paramsData?.roomId;
  const userId = paramsData?.userId;
  const roomName = paramsData?.roomName;
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Fetch messages from the room when the component loads
  useEffect(() => {
    const fetchMessages = async () => {
      if (!roomId) {
        setError("Room not found.");
        return;
      }

      const { data, error } = await supabaseBrowserClient
        .from("messages")
        .select(
          "message, sent_at, user_id(id, user_name), room_id(id, room_name)"
        )
        .eq("room_id", roomId)
        .order("sent_at", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setMessages(data);
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
  }, []);

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

  return (
    <div className=" bg-gradient-to-br from-purple-700 via-purple-800 to-purple-900 h-full min-h-screen flex flex-col">
      {/* Header */}
      <h1 className="text-4xl font-extrabold mb-6 text-white fixed  w-full top-0 py-4  z-20 shadow-xl flex items-center justify-center">
        Chat Room Name:{" "}
        <i className="ml-2 font-bold text-4xl">
          {messages?.[0]?.room_id?.room_name}
        </i>
      </h1>

      {/* Displaying error if any */}
      {error && (
        <p className="text-red-500 mb-6 text-center font-semibold text-lg">
          {error}
        </p>
      )}

      {/* Displaying messages */}
      <div className="overflow-y-auto flex-1 pt-[90px] pb-20 px-6">
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
                      className={`p-4 rounded-lg break-all max-w-[80%] ${
                        isCurrentUser
                          ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                          : "bg-gray-800 text-white shadow-md"
                      }`}
                    >
                      {message.message}
                      <p className="text-sm text-gray-300 mt-1">
                        {new Date(message.sent_at).toLocaleString()}
                      </p>
                    </span>
                    <span className="font-semibold text-white mt-2 text-sm">
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
      <div className="mt-4 flex items-center space-x-4 sticky bottom-0  py-4 px-6 z-30 shadow-md">
        <Input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message"
          className="p-3 w-full h-[40px] max-w-full text-lg bg-gray-800 text-white rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300 ease-in-out transform hover:scale-103"
        />
        <Button
          onClick={handleSendMessage}
          className="p-2 bg-transparent text-white  hover:bg-transparent transition duration-200 transform hover:scale-110 flex items-center justify-center shadow-none"
        >
          <PaperAirplaneIcon className="!h-10 !w-10 text-purple-500 fill-purple-100" />{" "}
          {/* Send Icon */}
        </Button>
      </div>
    </div>
  );
}
export default function AboutPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AboutPage />
    </Suspense>
  );
}
