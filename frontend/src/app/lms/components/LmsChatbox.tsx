"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import { lmsService } from "@/services/lmsService";
import type { LmsChatMessage } from "./ChatMessage";

const STREAM_CHUNK_SIZE = 4;
const STREAM_INTERVAL_MS = 18;

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const MOCK_MESSAGES: LmsChatMessage[] = [
  {
    id: "mock-1",
    role: "user",
    content:
      "Bạn có thể giúp tôi soạn nhận xét cho học viên Nguyễn Minh Khoa, lớp 5, buổi học Coding đầu tiên, em rất chăm chú và hoàn thành được bài tập vẽ hình bằng Scratch không?",
  },
  {
    id: "mock-2",
    role: "assistant",
    content: `Tư duy lập trình
- Em Khoa thể hiện sự tập trung và chú ý lắng nghe tốt trong suốt buổi học.
- Hoàn thành bài tập vẽ hình bằng Scratch một cách độc lập — đây là thành tích đáng khích lệ cho buổi đầu tiên.

Khả năng tiếp thu
- Em nắm bắt khái niệm cơ bản về lập trình trực quan (block-based) khá nhanh.
- Biết kéo thả các khối lệnh và phối hợp chúng để tạo ra kết quả mong muốn.

Định hướng tiếp theo
- Khuyến khích em thử thêm các dự án nhỏ có tính tương tác (nhân vật di chuyển, đổi màu).
- Có thể giới thiệu vòng lặp đơn giản ở buổi học tiếp theo để mở rộng tư duy.`,
  },
];

export function LmsChatbox() {
  const [messages, setMessages] = useState<LmsChatMessage[]>(MOCK_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
  };

  const applyChunk = useCallback(
    (messageId: string, chunk: string, isDone: boolean) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: chunk, isStreaming: !isDone }
            : m,
        ),
      );
    },
    [],
  );

  const simulateStream = useCallback(
    (messageId: string, fullText: string, onDone?: () => void) => {
      stopStream();
      let index = 0;

      streamIntervalRef.current = setInterval(() => {
        index += STREAM_CHUNK_SIZE;
        const chunk = fullText.slice(0, index);
        const isDone = index >= fullText.length;
        applyChunk(messageId, chunk, isDone);
        if (isDone) {
          stopStream();
          onDone?.();
        }
      }, STREAM_INTERVAL_MS);
    },
    [applyChunk],
  );

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg: LmsChatMessage = {
      id: generateId(),
      role: "user",
      content: text,
    };
    const aiMsgId = generateId();
    const aiPlaceholder: LmsChatMessage = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, aiPlaceholder]);
    setInputValue("");
    setIsLoading(true);

    try {
      const historyForBackend = messages
        .filter((m) => m.content && m.content.length > 0)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const result = await lmsService.chat({
        message: text,
        history: historyForBackend,
      });

      if (result.aiUnavailable) {
        const reason = result.reason || "AI tạm thời không khả dụng";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: `AI tạm thời không khả dụng (${reason}). Vui lòng thử lại sau.`,
                  isStreaming: false,
                }
              : m,
          ),
        );
        setIsLoading(false);
        return;
      }

      const aiText = result.data?.text || "Xin lỗi, tôi không thể trả lời lúc này.";
      simulateStream(aiMsgId, aiText, () => {
        setIsLoading(false);
      });
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || "Lỗi không xác định";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: `Lỗi: ${errMsg}`,
                isStreaming: false,
              }
            : m,
        ),
      );
      toast.error("Không thể kết nối AI", { description: errMsg });
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    stopStream();
    setMessages([]);
    setInputValue("");
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[420px]">
      <div className="flex items-center gap-2 pb-3 border-b border-border mb-3">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-sm font-medium text-foreground">AI Assistant</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {messages.length > 0 ? `${messages.length} tin nhắn` : "Sẵn sàng"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 scroll-smooth">
        <ChatMessageList messages={messages} isLoading={false} />
      </div>

      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        onClear={messages.length > 0 ? handleClear : undefined}
        loading={isLoading}
        disabled={isLoading}
      />
    </div>
  );
}

export default LmsChatbox;
