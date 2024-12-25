"use client";

import { supabaseBrowserClient } from "@utils/supabase/client";
import { useEffect, useRef, useState } from "react";
import { ParamsStore } from "@zustandstore/redux";
import { Input } from "@*/components/ui/input";
import { Button } from "@*/components/ui/button";
import PaperAirplaneIcon from "@heroicons/react/24/outline/PaperAirplaneIcon";

export const PersonalChatRoomPage = () => {
  const { paramsData } = ParamsStore();
  const roomId = paramsData?.roomId;
  const userId = paramsData?.userId;
  const [uniqueUsers, setUniqueUsers] = useState<any[]>([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [messageData, setMessageData] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Function to fetch all messages
    const fetchMessagesData = async () => {
      if (roomId) {
        const { data, error } = await supabaseBrowserClient
          .from("messages")
          .select("*,user_id(id,user_name)")
          .eq("room_id", roomId);

        if (error) {
          console.error("Error fetching messages:", error);
        } else {
          const filteredMessages = Array.from(
            new Map(data.map((item) => [item.user_id.id, item])).values()
          );
          setUniqueUsers(filteredMessages || []);
        }
      }
    };

    // Initial fetch of messages
    fetchMessagesData();
    // Real-time subscription to listen for new messages
    const messageSubscription = supabaseBrowserClient
      .channel(`room1:${roomId}`) // Create a channel for the room
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          fetchMessagesData();
        }
      )
      .subscribe();
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageData]);
  const handleClick = (id: any) => {
    setActiveUserId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    const fetchPersonalMessages = async () => {
      if (userId && activeUserId) {
        const { data, error } = await supabaseBrowserClient
          .from("personal_messages")
          .select("*")
          .or(
            `and(from_id.eq.${userId},to_id.eq.${activeUserId}),and(from_id.eq.${activeUserId},to_id.eq.${userId})`
          )
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });

        if (error) {
          console.error("Error fetching data:", error.message);
        } else {
          console.log("Fetched data: ", data); // Log the fetched data
          setMessageData(data); // Set the fetched data into the state
        }
      }
    };
    fetchPersonalMessages();
    const messageSubscription = supabaseBrowserClient
      .channel(`room4:${roomId}`) // Create a channel for the room
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "personal_messages" },
        (payload) => {
          fetchPersonalMessages();
        }
      )
      .subscribe();
    return () => {
      messageSubscription.unsubscribe();
    };
  });

  return (
    <div className="gap-4 w-[50%] text-white bg-black p-6  border-2 border-purple-600">
      {uniqueUsers.map((item) => (
        <div
          key={item.user_id.id}
          className="border border-purple-600 p-4 rounded-xl shadow-md cursor-pointer mb-2"
          onClick={() => handleClick(item.user_id.id)}
        >
          <h3 className="text-lg font-semibold">{item.user_id?.user_name}</h3>
          {activeUserId === item.user_id.id && (
            <div className="mt-2 p-2 border border-purple-600 bg-black max-h-[800px] overflow-y-auto custom-scrollbar rounded-xl">
              <div className="max-h-[500px] pr-2 overflow-y-auto custom-scrollbar">
                {messageData ? (
                  messageData.map((message: any) => (
                    <div
                      key={message.id}
                      className={`px-4 py-2 rounded-tl-3xl rounded-tr-3xl ${
                        message.from_id === userId
                          ? "rounded-bl-3xl bg-purple-800 text-white text-xl w-fit ml-auto"
                          : "rounded-br-3xl bg-white text-black text-xl w-fit mr-auto"
                      } break-all mb-1`}
                    >
                      <p>{message.message}</p>
                    </div>
                  ))
                ) : (
                  <p>Loading messages...</p>
                )}
                {/* Empty div that is always at the bottom of the container */}
                <div ref={bottomRef} />
              </div>
              <div
                className="flex items-center space-x-4 sticky bottom-0  z-30 shadow-md bg-black pt-4"
                onClick={(e) => e.stopPropagation()} // Prevent closing on input click
              >
                <Input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message here  Connect together 😊..."
                  className="p-3 w-full h-[40px] max-w-full text-lg text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300 ease-in-out transform hover:scale-103 border-2 border-purple-600"
                />

                <Button
                  onClick={() => {
                    handleUserDetails(
                      roomId,
                      userId,
                      item.user_id?.id,
                      newMessage
                    );
                    setNewMessage(""); // Clear the input after sending the message
                  }}
                  className="p-2 bg-transparent text-white hover:bg-transparent transition duration-200 transform hover:scale-110 flex items-center justify-center shadow-none"
                >
                  <PaperAirplaneIcon className="!h-8 !w-8 text-purple-500" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
async function handleUserDetails(
  roomId: any,
  userId: any,
  id: any,
  newMessage: any
) {
  try {
    // Example: Fetching user data from Supabase
    const { error } = await supabaseBrowserClient
      .from("personal_messages")
      .insert([
        { room_id: roomId, from_id: userId, to_id: id, message: newMessage },
      ]);

    if (error) {
      console.error("Error fetching data:", error.message);
    } else {
      // Add your functionality here, e.g., updating state or further processing
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}
