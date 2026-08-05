"use client";

import { Loader2, Send, Trash2 } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly onClear?: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onClear,
  disabled = false,
  loading = false,
  placeholder = "Nhập câu hỏi... (Enter để gửi, Shift+Enter xuống dòng)",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !loading && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="flex gap-2 items-end border-t border-border pt-3">
      {onClear && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          title="Xóa hội thoại"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || loading}
        rows={1}
        className="flex-1 resize-none rounded-xl text-sm border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 max-h-32 min-h-[40px]"
        style={{ borderRadius: 12 }}
      />

      <Button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 rounded-xl"
        style={{ borderRadius: 12 }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Gửi</span>
      </Button>
    </div>
  );
}

export default ChatInput;
