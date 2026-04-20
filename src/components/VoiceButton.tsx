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
    <Button
      type="button"
      size="sm"
      variant={listening ? "default" : "outline"}
      onClick={listening ? stop : start}
      title={title}
      className={`h-9 w-9 p-0 flex-shrink-0 ${listening ? "animate-pulse bg-destructive hover:bg-destructive/90" : ""} ${className || ""}`}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
