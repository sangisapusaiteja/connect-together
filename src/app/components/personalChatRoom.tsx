"use client";

import { supabaseBrowserClient } from "@utils/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@*/components/ui/input";
import { Button } from "@*/components/ui/button";
import PaperAirplaneIcon from "@heroicons/react/24/outline/PaperAirplaneIcon";
import CryptoJS from "crypto-js";
import { useSearchParams } from "next/navigation";

export const PersonalChatRoomPage = () => {
  const [uniqueUsers, setUniqueUsers] = useState<any[]>([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [messageData, setMessageData] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const secretKey = "key"; // Same key used for encryption

  const searchParams = useSearchParams();
  const encryptedRoomId = searchParams.get("roomId");
  const encryptedUserId = searchParams.get("userId");

  const [roomId, setRoomId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

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

        const decryptedRoomId = parseInt(
          decryptedRoomIdBytes.toString(CryptoJS.enc.Utf8),
          10
        );
        const decryptedUserId = parseInt(
          decryptedUserIdBytes.toString(CryptoJS.enc.Utf8),
          10
        );

        // Ensure they are valid numbers
        if (isNaN(decryptedRoomId) || isNaN(decryptedUserId)) {
          throw new Error("Decryption resulted in invalid numbers");
        }

        setRoomId(decryptedRoomId);
        setUserId(decryptedUserId);
      } catch (e) {
        console.error("Decryption error:", e);
        setError("Decryption error occurred");
      }
    }
  }, [encryptedRoomId, encryptedUserId]);

  useEffect(() => {
    // Function to fetch all messages
    const fetchMessagesData = async () => {
      if (roomId) {
        const { data, error } = await supabaseBrowserClient
          .from("messages")
          .select("*,user_id(id,user_name,profile_pic)")
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
  }, [roomId]);

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
  }, [activeUserId]);

  return (
    <div className="my-10 mr-10 ml-5 bg-[#131314] flex flex-col w-[50%] rounded-3xl">
      {uniqueUsers.map((item) => (
        <div
          key={item.user_id.id}
          className="border border-white mx-4 p-4 mt-4 rounded-3xl cursor-pointer"
          onClick={() => handleClick(item.user_id.id)}
        >
          <div className="flex items-center gap-3">
            <img
              src={item.user_id?.profile_pic || "/assets/default_image.png"}
              alt="Profile"
              className="w-[70px] h-[70px] rounded-full object-cover mr-2 mb-2 border-2"
            />
            <h3 className="text-white text-lg font-semibold break-all">
              {item.user_id?.user_name}
            </h3>
          </div>
          {activeUserId === item.user_id.id && (
            <div className="py-2 pl-2 border-2 border-[#3A3A40] bg-black max-h-[800px] rounded-2xl">
              <div className="min-h-[100px] max-h-[500px] overflow-y-auto custom-scrollbar">
                {messageData ? (
                  messageData.map((message: any) => (
                    <div
                      key={message.id}
                      className={`px-4 py-2 rounded-tl-3xl rounded-tr-3xl ${
                        message.from_id === userId
                          ? "rounded-bl-3xl bg-white text-black text-xl w-fit ml-auto mr-2"
                          : "rounded-br-3xl bg-[#3A3A40] text-white text-xl w-fit mr-auto"
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
                className="flex items-center border  rounded-3xl h-10 pr-3 mt-2 w-full"
                onClick={(e) => e.stopPropagation()} // Prevent closing on input click
              >
                <Input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type to Connect 😊..."
                  className="border-none text-white ml-4 h-[30px]"
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
                  className="bg-black hover:bg-black text-white hover:text-green-500 w-5"
                >
                  <PaperAirplaneIcon className="!h-8 !w-8" />
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
