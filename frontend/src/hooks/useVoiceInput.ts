import { useState } from "react";

export function useVoiceInput(onTranscript?: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);

  const startListening = () => {
    setIsListening(true);
    // Simulate micro ambient volume level spikes for orb visualization
    const interval = setInterval(() => {
      setVolume(Math.random() * 0.6 + 0.1);
    }, 100);
    (window as any)._voiceInterval = interval;
  };

  const stopListening = () => {
    setIsListening(false);
    setVolume(0);
    clearInterval((window as any)._voiceInterval);

    // Mock speech transcript mapping
    if (onTranscript) {
      onTranscript("Summarize active system status.");
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return {
    isListening,
    volume,
    startListening,
    stopListening,
    toggleListening,
  };
}
