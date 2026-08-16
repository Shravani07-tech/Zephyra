import { useState } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = (text: string) => {
    // Mock speaking output logs
    console.log("Zephyra speech output:", text);
    setIsSpeaking(true);
    // Simulate speaking duration based on content length
    const duration = Math.min(3000, text.length * 40);
    setTimeout(() => {
      setIsSpeaking(false);
    }, duration);
  };

  const stop = () => {
    setIsSpeaking(false);
  };

  return {
    isSpeaking,
    speak,
    stop,
  };
}
