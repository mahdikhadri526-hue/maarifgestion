import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface VoiceButtonProps {
  onResult: (text: string) => void;
  parseNumber?: boolean;
  title?: string;
  className?: string;
}

export function VoiceButton({ onResult, parseNumber, title = "Dicter", className }: VoiceButtonProps) {
  const { listening, supported, start, stop } = useVoiceInput({ onResult, parseNumber });

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={title}
      className={`inline-flex items-center justify-center h-9 w-9 p-0 flex-shrink-0 rounded-md border transition-colors ${
        listening
          ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
          : "bg-background hover:bg-accent border-input"
      } ${className || ""}`}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
