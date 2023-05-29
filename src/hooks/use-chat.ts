import { fetchEventSource } from "@fortaine/fetch-event-source";
import { useState, useMemo } from "react";
import { appConfig } from "../../config.browser";
import { eventNames } from "process";

const API_PATH = "http://127.0.0.1:8000/";
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * A custom hook to handle the chat state and logic
 */
export function useChat() {
  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [condition, setCondition] = useState<string>("");
  const [state, setState] = useState<"idle" | "waiting" | "loading">("idle");

  // Lets us cancel the stream
  const abortController = useMemo(() => new AbortController(), []);

  /**
   * Cancels the current chat and adds the current chat to the history
   */
  function cancel() {
    setState("idle");
    abortController.abort();
    if (currentChat) {
      const newHistory = [
        ...chatHistory,
        { role: "user", content: currentChat } as const,
      ];

      setChatHistory(newHistory);
      setCurrentChat("");
    }
  }

  /**
   * Clears the chat history
   */

  function clear() {
    console.log("clear");
    setChatHistory([]);
  }

  /**
   * Sends a new message to the AI function and streams the response
   */
  const sendMessage = (message: string, chatHistory: Array<ChatMessage>) => {
    setState("waiting");
    const newHistory = [
      ...chatHistory,
      { role: "user", content: message } as const,
    ];

    setChatHistory(newHistory);
    const status = newHistory.length === 1 ? "initial" : "continue";
    console.log("condition: " + condition);
    if (!condition) {
      console.log("condition is empty");
      const body = JSON.stringify({
        condition: condition,
      });
      console.log("body: " + body);
      fetch(API_PATH + "set_condition", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: body
      })
        .then(response => response.json())
        .then(data => {
          console.log(data)
          const chatContent = data.message;
          setChatHistory((curr) => [
            ...curr,
            { role: "assistant", content: chatContent } as const,
          ]);
          setCurrentChat(null);
          setState("idle");
        })
    } else {
      const body = JSON.stringify({
        // messages: newHistory.slice(-appConfig.historyLength),
        message: message,
        status: status,
      });
      fetch(API_PATH, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: body
      })
        .then(response => response.json())
        .then(data => {
          console.log(data)
          const chatContent = data.message;
          setChatHistory((curr) => [
            ...curr,
            { role: "assistant", content: chatContent } as const,
          ]);
          setCurrentChat(null);
          setState("idle");
        })
        .catch((error) => {
          console.error('Error:', error);
          setState("idle");
        });
    };
  };


  return { sendMessage, currentChat, chatHistory, cancel, clear, state };
}
