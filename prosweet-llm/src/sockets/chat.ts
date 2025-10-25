import { Server, Socket } from "socket.io";
import { v4 as uuid } from 'uuid';

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
  baseURL: process.env['OPENAI_ENDPOINT']
});

const sysPrompt = `
You're a helpful chat bot that always assists the user with their questions or commands.
`;

const chatMap = new Map<string, OpenAI.Chat.Completions.ChatCompletionMessageParam[]>();

type MessagePayload = {
  userId: string
  msg: string
}

export default function setupChatSocketEvents(io: Server) {
  io.on("connection", (socket) => {
    console.log(`Socket ${socket.id} connected`);

    socket.emit("useid", uuid());

    socket.on("initwithid", (id: string) => {
      if (!chatMap.has(id)) {
        chatMap.set(id, [
          { role: 'system', content: sysPrompt }
        ]);
      }
    });

    socket.on("usermessage", (userMessage: MessagePayload) => {
      if (!chatMap.has(userMessage.userId)) {
        socket.emit("chaterr", "cart placed before horse");
        return;
      }

      console.log("got user message: \"" + userMessage + "\" from socket " + socket);
      var currentBotMessage = "";
      chatMap.set(userMessage.userId, chatMap.get(userMessage.userId)!.concat({ role: 'user', content: userMessage.msg }));
      client.chat.completions.create({
        model: "google/gemini-2.5-flash",
        messages: chatMap.get(userMessage.userId)!,
        stream: true,
      }).then(async (stream) => {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';

          if (content) {
            socket.emit("botresponse", {block: content, endStream: false});
            currentBotMessage += content;
          }
        }
      }).catch(async (err) => {
        socket.emit("chaterr", err);
      }).finally(async () => {
        chatMap.set(userMessage.userId, chatMap.get(userMessage.userId)!.concat({ role: 'assistant', content: currentBotMessage }));
        socket.emit("botresponse", {block: "", endStream: true});
        console.log(chatMap.get(userMessage.userId));
      });
    });

    socket.on("disconnect", () => {
      console.log(`Socket ${socket.id} disconnected`);
    });
  });
}