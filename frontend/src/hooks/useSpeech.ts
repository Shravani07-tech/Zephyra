import { useState, useRef, useEffect } from "react";

// Phase 3: TTS Text Sanitizer
export function prepareSpeechText(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Remove code blocks (```...```) entirely
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");

  // 2. Remove inline code backticks, preserving the text inside
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // 3. Remove raw URLs or convert them to domain
  cleaned = cleaned.replace(/https?:\/\/([^\s()]+)/g, (_match, domain) => {
    return domain.split("/")[0] || "";
  });

  // 4. Handle Markdown Links: [text](url) -> keep text, remove url
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 5. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // 6. Clean up headings: e.g., "### Title!" -> "Title." or "Title!"
  cleaned = cleaned.replace(/^(?:#+\s*)(.+?)[.!?;:]*$/gm, "$1.");

  // 7. Natural conversion of numbered lists (e.g. 1. -> First,, 2. -> Second,)
  const listWordMap: Record<string, string> = {
    "1.": "First,",
    "2.": "Second,",
    "3.": "Third,",
    "4.": "Fourth,",
    "5.": "Fifth,",
    "6.": "Sixth,",
    "7.": "Seventh,",
    "8.": "Eighth,",
    "9.": "Ninth,",
    "10.": "Tenth,"
  };
  cleaned = cleaned.replace(/^(?:\s*(\d+\.)\s+)(.+?)[.!?;:]*$/gm, (_match, num, content) => {
    const word = listWordMap[num] || num;
    return `${word} ${content}.`;
  });

  // Clean up bullet list markers
  cleaned = cleaned.replace(/^(?:\s*[-*+]\s+)(.+?)[.!?;:]*$/gm, "$1.");

  // 8. Remove formatting brackets/braces/parentheses if they wrap JSON-like text
  cleaned = cleaned.replace(/[{}]/g, "");

  // 9. Remove decorative separators: dashes (---), equal signs (===), stars (***)
  cleaned = cleaned.replace(/^[-*=]{3,}\s*$/gm, "");

  // 10. Strip emojis
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, "");

  // 11. Remove bold/italic markers
  cleaned = cleaned.replace(/[*_]{1,3}/g, "");

  // 12. Clean up excessive whitespace and newlines
  cleaned = cleaned.replace(/\n+/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ");

  // 13. Clean up any trailing double periods (e.g., from heading/bullet replacement)
  cleaned = cleaned.replace(/\.+/g, ".");

  // 14. Ensure proper spacing after sentence punctuation
  cleaned = cleaned.replace(/([.!?])([a-zA-Z])/g, "$1 $2");

  return cleaned.trim();
}

// Phase 5: Chunk Text into Sentences
export function chunkTextIntoSentences(text: string): string[] {
  if (!text) return [];

  // Match sentences ending in punctuation or end of line
  const sentenceRegex = /[^.!?]+(?:[.!?]+|$)/g;
  const chunks = text.match(sentenceRegex) || [text];

  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

// Phase 4: Deterministic Voice Selection
export function selectBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));

  const getScore = (voice: SpeechSynthesisVoice) => {
    let score = 0;
    const nameLower = voice.name.toLowerCase();

    if (nameLower.includes("natural")) score += 100;
    if (nameLower.includes("premium")) score += 80;
    if (nameLower.includes("neural")) score += 80;
    if (nameLower.includes("google")) score += 50;
    if (nameLower.includes("microsoft")) score += 30;

    if (nameLower.includes("samantha")) score += 70;
    if (nameLower.includes("daniel")) score += 60;
    if (nameLower.includes("hazel")) score += 60;
    if (nameLower.includes("zira")) score += 40;
    if (nameLower.includes("david")) score += 40;

    if (voice.localService) score += 20;

    if (voice.lang.toLowerCase() === "en-us") score += 10;
    if (voice.lang.toLowerCase() === "en-gb") score += 8;

    return score;
  };

  const englishVoicesWithScores = enVoices.map((v) => ({ voice: v, score: getScore(v) }));

  if (englishVoicesWithScores.length > 0) {
    englishVoicesWithScores.sort((a, b) => b.score - a.score);
    return englishVoicesWithScores[0].voice;
  }

  // Fallback 1: Default voice
  const defaultVoice = voices.find((v) => v.default);
  if (defaultVoice) return defaultVoice;

  // Fallback 2: First voice
  return voices[0];
}

export function useSpeech(options?: { onEnd?: () => void }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunkQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  const activeVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Tracks active speech session counter to prevent race conditions with stale callbacks
  const activeSessionIdRef = useRef<number>(0);

  // Initialize and track available voices asynchronously
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Update active voice when voices list changes
  useEffect(() => {
    activeVoiceRef.current = selectBestVoice(voices);
  }, [voices]);

  const speakNextChunk = (sessionId: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Reject stale session callbacks immediately
    if (sessionId !== activeSessionIdRef.current) return;

    if (chunkQueueRef.current.length === 0 || !isSpeakingRef.current) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      options?.onEnd?.();
      return;
    }

    const nextText = chunkQueueRef.current.shift();
    if (!nextText) {
      speakNextChunk(sessionId);
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(nextText);
      utteranceRef.current = utterance;

      if (activeVoiceRef.current) {
        utterance.voice = activeVoiceRef.current;
      }

      // Configure natural voice profile parameters
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        if (sessionId !== activeSessionIdRef.current) return;
        speakNextChunk(sessionId);
      };

      utterance.onerror = (event) => {
        console.log("Speech synthesis chunk error or interrupt:", event.error);
        if (sessionId !== activeSessionIdRef.current) return;

        if (event.error === "interrupted") {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          options?.onEnd?.();
        } else {
          // Play remaining chunks on other non-fatal errors
          speakNextChunk(sessionId);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Error playing chunk:", e);
      speakNextChunk(sessionId);
    }
  };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.warn("Speech synthesis is not supported in this environment.");
      options?.onEnd?.();
      return;
    }

    // Invalidate active session to prevent race conditions with older ongoing TTS
    const sessionId = ++activeSessionIdRef.current;

    try {
      // Cancel any active utterance and reset state
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      // Clean, sanitize, and partition text into sentence chunks
      const sanitizedText = prepareSpeechText(text);
      const chunks = chunkTextIntoSentences(sanitizedText);
      chunkQueueRef.current = chunks;

      if (chunks.length === 0) {
        options?.onEnd?.();
        return;
      }

      setIsSpeaking(true);
      isSpeakingRef.current = true;
      speakNextChunk(sessionId);
    } catch (error) {
      console.error("Failed to start speech synthesis:", error);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      options?.onEnd?.();
    }
  };

  const stop = () => {
    // Increment session ID to cancel callbacks from ongoing utterance chunk transitions
    activeSessionIdRef.current++;
    isSpeakingRef.current = false;
    chunkQueueRef.current = [];
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    options?.onEnd?.();
  };

  // Safe cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isSpeaking,
    speak,
    stop,
    voices,
    selectedVoice: activeVoiceRef.current,
  };
}
