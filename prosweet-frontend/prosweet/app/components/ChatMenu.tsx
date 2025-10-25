"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import TextInput from "./TextInput";
import ChatButton from "./ChatButton";
import ChatMessage from "./ChatMessage";

const socket = io("ws://localhost:3000", {
  reconnectionDelay: 10000, // defaults to 1000
  reconnectionDelayMax: 10000 // defaults to 5000
});

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
    if (sending.current) return;
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
      socket.on("botresponse", (res) => {
        onReceiveTextBlock(res);
        console.log(res);
      });
      socket.on("chaterr", (err) => {
        console.log(err);
      });
      socket.on("useid", (id) => {
        console.log(id);
        if (curId !== ""){
          console.log("but who cares?")
          setId(id);
        }
      })
    }
  }, []);

  useEffect(() => {
    socket.emit("initwithid", curId);
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
      console.log("fin");
    }
  }, [botFinished]);

  return <>
<div className="text-6xl font-bold">    <h1>Chat here</h1>
</div>
  
    {effectiveMessageHistory().map((val:ChatMessageData) => <ChatMessage key={val.id} messageType={val.type} messageContent={val.msg} />)}
    <TextInput inputContent={input} onChange={onTextChange} />
    <ChatButton type={generatingMessage ? 'stop' : (input.length > 0 ? 'send' : 'disabled')}
      onSend={onSend} onStop={onStop} />
  </>
}