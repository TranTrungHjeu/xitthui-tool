"use client";

import { useEffect, useRef } from "react";
import ChatMessage, { type LmsChatMessage } from "./ChatMessage";

interface ChatMessageListProps {
  readonly messages: LmsChatMessage[];
  readonly isLoading?: boolean;
}

export function ChatMessageList({ messages, isLoading = false }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 select-none py-10">
        <div className="text-4xl">💬</div>
        <p className="text-sm">Hãy đặt câu hỏi cho AI...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {isLoading && (
        <div className="flex gap-3 mb-4">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
            AI
          </div>
          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

export default ChatMessageList;
