"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import TextInput from "./TextInput";
import ChatButton from "./ChatButton";
import ChatMessage from "./ChatMessage";

const socket = io("ws://localhost:3000", {
  reconnectionDelay: 10000,
  reconnectionDelayMax: 10000
});

// Add your secret key here (should match backend SECRET_KEY env variable)
const SECRET_KEY = process.env.NEXT_PUBLIC_SECRET_KEY || "my-super-secret-chat-key-12345";

type ChatMessageData = {
  id: number,
  type: 'user' | 'bot',
  msg: string
}

type MessageBlock = {
  block: string
  endStream: boolean
}

export default function ChatMenu() {
  const [curId, setId] = useState("");
  const [input, setInput] = useState("");
  const [messageHistory, setMessageHistory] = useState<ChatMessageData[]>([]);
  const [latestBotMessage, setLatestBotMessage] = useState("");
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [botFinished, setBotFinished] = useState(false);
  const [connected, setConnected] = useState(false);
  const sending = useRef(false);
  const socketBound = useRef(false);
  
  const onTextChange = (text: string) => {
    setInput(text);
  }

  const onReceiveTextBlock = (text: MessageBlock) => {
    setLatestBotMessage(prev => prev + text.block);
    if (text.endStream) {
      setBotFinished(true);
    }
  }

  const onSend = () => {
    if (sending.current || !curId) return;
    sending.current = true;

    socket.emit("usermessage", {
      userId: curId,
      msg: input
    });
    setMessageHistory(messageHistory.concat({
      id: messageHistory.length,
      type: 'user',
      msg: input
    }));
    setInput("");
    setLatestBotMessage("");
    setGeneratingMessage(true);
  }

  const onStop = () => {
    setGeneratingMessage(false);
  }

  const effectiveMessageHistory = () => {
    if (generatingMessage) {
      return messageHistory.concat({
        id: messageHistory.length,
        type: 'bot',
        msg: latestBotMessage
      });
    }
    return messageHistory;
  }

  useEffect(() => {
    if (!socketBound.current) {
      socketBound.current = true;
      
      socket.on("connect", () => {
        console.log("Socket connected!");
        setConnected(true);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected!");
        setConnected(false);
      });

      socket.on("useid", (id: string) => {
        console.log("Received user ID:", id);
        setId(id);
      });

      socket.on("botresponse", (res: MessageBlock) => {
        onReceiveTextBlock(res);
        console.log("Bot response:", res);
      });

      socket.on("chaterr", (err: any) => {
        console.error("Chat error:", err);
        alert("Chat error: " + err);
        setGeneratingMessage(false);
        sending.current = false;
      });
    }
  }, []);

  useEffect(() => {
    if (curId) {
      console.log("Initializing chat with ID:", curId);
      socket.emit("initwithid", {
        userId: curId,
        secretKey: SECRET_KEY
      });
    }
  }, [curId]);

  useEffect(() => {
    if (botFinished) {
      setMessageHistory(prev => prev.concat({
        id: prev.length,
        type: 'bot',
        msg: latestBotMessage
      }));
      setLatestBotMessage("");
      setGeneratingMessage(false);
      setBotFinished(false);
      sending.current = false;
      console.log("Message finished");
    }
  }, [botFinished]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4">
        <h1 className="text-4xl font-bold mb-2">Chat here</h1>
        <p className="text-sm text-gray-600">
          Status: {connected ? "🟢 Connected" : "🔴 Disconnected"} 
          {curId && ` | User ID: ${curId.slice(0, 8)}...`}
        </p>
      </div>

      <div className="mb-4 space-y-2 min-h-[300px] max-h-[600px] overflow-y-auto bg-gray-50 p-4 rounded-lg">
        {effectiveMessageHistory().length === 0 ? (
          <p className="text-gray-400 text-center">No messages yet. Start chatting!</p>
        ) : (
          effectiveMessageHistory().map((val: ChatMessageData) => (
            <ChatMessage key={val.id} messageType={val.type} messageContent={val.msg} />
          ))
        )}
      </div>

      <div className="space-y-2">
        <TextInput inputContent={input} onChange={onTextChange} />
        <ChatButton 
          type={generatingMessage ? 'stop' : (input.length > 0 && connected ? 'send' : 'disabled')}
          onSend={onSend} 
          onStop={onStop} 
        />
      </div>
    </div>
  );
}