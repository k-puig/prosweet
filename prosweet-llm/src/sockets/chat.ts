import { Server, Socket } from "socket.io";
import { v4 as uuid } from 'uuid';

import {Chat, GoogleGenAI} from '@google/genai';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  throw new Error("No secret key provided. This is needed to secure socket access.");
}

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY, apiVersion: 'v1alpha'});

const sysPrompt = `
You're a helpful chat bot that always assists the user with their questions or commands.
`;

const chatMap = new Map<string, Chat>();

type MessagePayload = {
  userId: string
  msg: string
}

type UserCredentials = {
  userId: string,
  secretKey: string
}

export default function setupChatSocketEvents(io: Server) {
  io.on("connection", (socket) => {
    console.log(`Socket ${socket.id} connected`);

    socket.emit("useid", uuid());

    socket.on("initwithid", (cred: UserCredentials) => {
      if (!chatMap.has(cred.userId) && cred.secretKey == SECRET_KEY) {
        chatMap.set(cred.userId, ai.chats.create({
          model: 'gemini-2.5-flash',
          config: { systemInstruction: sysPrompt }
        }));
      }
    });

    socket.on("usermessage", (userMessage: MessagePayload) => {
      if (!chatMap.has(userMessage.userId)) {
        socket.emit("chaterr", "cart placed before horse");
        return;
      }

      console.log("got user message: \"" + userMessage + "\" from socket " + socket);
      var currentBotMessage = "";

      const chat = chatMap.get(userMessage.userId)!;
      chat.sendMessageStream({ message: userMessage.msg }).then(async (stream) => {
        for await (const chunk of stream) {
          const content = chunk.text;

          if (content) {
            socket.emit("botresponse", {block: content, endStream: false});
            currentBotMessage += content;
          }
        }
      }).catch(async (err) => {
        socket.emit("chaterr", err);
      }).finally(async () => {
        socket.emit("botresponse", {block: "", endStream: true});
      });
    });

    socket.on("disconnect", () => {
      console.log(`Socket ${socket.id} disconnected`);
    });
  });
}