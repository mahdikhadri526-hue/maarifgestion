import { forwardRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface VoiceButtonProps {
  onResult: (text: string) => void;
  parseNumber?: boolean;
  title?: string;
  className?: string;
}

export const VoiceButton = forwardRef<HTMLButtonElement, VoiceButtonProps>(
  ({ onResult, parseNumber, title = "Dicter", className }, ref) => {
    const { listening, supported, start, stop } = useVoiceInput({ onResult, parseNumber });

    if (!supported) return null;

    return (
      <Button
        ref={ref}
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
);
VoiceButton.displayName = "VoiceButton";
