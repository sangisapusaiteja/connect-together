"use client";

import { Button } from "@*/components/ui/button";
import { Input } from "@*/components/ui/input";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { Suspense, useEffect, useRef, useState } from "react";

import { useSearchParams } from "next/navigation";

function AboutPage() {
  const searchParams = useSearchParams();
  const roomId = parseInt(searchParams.get("roomId") ?? "", 10);
  const userId = parseInt(searchParams.get("userId") ?? "", 10);

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
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (payload.new.room_id === roomId) {
            setMessages((prevMessages) => [...prevMessages, payload.new]);
          }
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
    <div className="p-6 bg-black h-full min-h-screen flex flex-col">
      <h1 className="text-3xl font-bold mb-4 text-white fixed bg-black top-0 py-4 w-full z-10">
        Chat Room Name : <i>{messages?.[0]?.room_id?.room_name}</i>
      </h1>

      {/* Displaying error if any */}
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Displaying messages */}
      <div className="overflow-y-auto flex-1 custom-scroll pb-20">
        {/* Add scrolling behavior */}
        {messages.length > 0 ? (
          <ul className="list-disc list-inside">
            {messages.map((message, index) => {
              const isCurrentUser = message.user_id?.id === userId;
              return (
                <li
                  key={index}
                  className={`mb-2 flex ${
                    isCurrentUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex flex-col max-w-xs ${
                      isCurrentUser ? "items-end" : "items-start"
                    }`}
                  >
                    <span
                      className={`font-semibold ${
                        isCurrentUser ? "text-blue-500" : "text-red-700"
                      }`}
                    >
                      {message.user_id?.user_name}:
                    </span>
                    <span
                      className={`p-2 rounded-lg break-all ${
                        isCurrentUser
                          ? "bg-purple-400 text-white"
                          : "bg-red-400"
                      }`}
                    >
                      {message.message}
                    </span>
                    <p className="text-sm text-gray-500">
                      {new Date(message.sent_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No messages in this room yet.</p>
        )}
        {/* Scroll reference at the end of messages */}
        <div ref={messagesEndRef} />
      </div>

      {/* Form to send new message */}
      <div className="mt-4 flex items-center space-x-2 sticky bottom-0 bg-black py-2">
        <Input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message"
          className="p-2 border w-3/4 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-10 rounded-xl text-white font-bold"
        />
        <Button
          onClick={handleSendMessage}
          className="p-2 bg-blue-500 text-white rounded-xl w-1/4 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
        >
          Send
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
