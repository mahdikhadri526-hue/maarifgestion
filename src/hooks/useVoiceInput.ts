import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  const directMatch = cleaned.match(/\d+/);
  if (directMatch) return directMatch[0];
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

  const start = useCallback(async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Reconnaissance vocale non supportée. Utilisez Chrome ou Safari.");
      return;
    }

    // Vérifier HTTPS (sauf localhost)
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      toast.error("Le micro nécessite HTTPS. Ouvrez l'app via une URL sécurisée.");
      return;
    }

    // Demander explicitement la permission micro AVANT de lancer SpeechRecognition
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // On libère immédiatement, SpeechRecognition gère son propre flux
      stream.getTracks().forEach((t) => t.stop());
    } catch (err: any) {
      console.error("Erreur accès micro:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Accès micro refusé. Autorisez-le dans les réglages du navigateur (icône cadenas 🔒 à gauche de l'URL).", { duration: 6000 });
      } else if (err.name === "NotFoundError") {
        toast.error("Aucun microphone détecté sur l'appareil.");
      } else if (err.name === "NotReadableError") {
        toast.error("Le micro est utilisé par une autre application.");
      } else {
        toast.error("Erreur micro : " + (err.message || err.name));
      }
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
      console.error("SpeechRecognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("Accès micro refusé. Vérifiez les permissions du navigateur.", { duration: 6000 });
      } else if (event.error === "no-speech") {
        toast.error("Aucune voix détectée, réessayez.");
      } else if (event.error === "audio-capture") {
        toast.error("Aucun microphone trouvé.");
      } else if (event.error === "network") {
        toast.error("Erreur réseau. La reconnaissance vocale nécessite une connexion.");
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
      toast.error("Impossible de démarrer la reconnaissance vocale.");
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
