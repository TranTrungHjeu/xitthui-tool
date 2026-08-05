"use client";

import { Bot, User } from "lucide-react";
import Shimmer from "./Shimmer";

export type MessageRole = "user" | "assistant";

export interface LmsChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  readonly message: LmsChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <User className="h-4 w-4" />
          </div>
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
        )}
      </div>

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        }`}
      >
        {message.isStreaming ? (
          <span>
            {message.content ? (
              <>
                <Shimmer duration={1.5} className="text-sm leading-relaxed">
                  {message.content}
                </Shimmer>
                <span className="streaming-cursor" />
              </>
            ) : (
              <Shimmer duration={1.2} className="text-sm opacity-60">
                Đang suy nghĩ...
              </Shimmer>
            )}
          </span>
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
