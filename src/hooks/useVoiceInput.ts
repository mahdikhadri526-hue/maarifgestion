import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Convertit les mots français en nombres (ex: "cinq kilos" -> "5")
const WORD_TO_NUMBER: Record<string, number> = {
  "zero": 0, "zéro": 0,
  "un": 1, "une": 1,
  "deux": 2, "trois": 3, "quatre": 4, "cinq": 5,
  "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10,
  "onze": 11, "douze": 12, "treize": 13, "quatorze": 14, "quinze": 15,
  "seize": 16, "vingt": 20, "trente": 30, "quarante": 40,
  "cinquante": 50, "soixante": 60, "cent": 100, "mille": 1000,
};

export function parseFrenchNumber(text: string): string {
  const cleaned = text.toLowerCase().trim().replace(/[.,]/g, "");
  // Si déjà un nombre, on le retourne
  const directMatch = cleaned.match(/\d+/);
  if (directMatch) return directMatch[0];

  // Recherche mot à mot
  const words = cleaned.split(/\s+/);
  let total = 0;
  let found = false;
  for (const w of words) {
    if (WORD_TO_NUMBER[w] !== undefined) {
      total += WORD_TO_NUMBER[w];
      found = true;
    }
  }
  return found ? String(total) : text;
}

interface UseVoiceInputOptions {
  onResult: (text: string) => void;
  parseNumber?: boolean;
  lang?: string;
}

export function useVoiceInput({ onResult, parseNumber = false, lang = "fr-FR" }: UseVoiceInputOptions) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SpeechRecognition);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Reconnaissance vocale non supportée sur ce navigateur");
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event: any) => {
      setListening(false);
      if (event.error === "not-allowed") {
        toast.error("Accès au microphone refusé");
      } else if (event.error === "no-speech") {
        toast.error("Aucune voix détectée, réessayez");
      } else {
        toast.error("Erreur micro : " + event.error);
      }
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const value = parseNumber ? parseFrenchNumber(transcript) : transcript.trim();
      onResult(value);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setListening(false);
      console.error(e);
    }
  }, [lang, onResult, parseNumber]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
