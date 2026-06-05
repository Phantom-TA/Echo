export interface Message {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'data';
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  sessionId?: string;
}

export interface ChatContext {
  query: string;
  retrievedChunks: string;
  hasCalendarIntent: boolean;
}

export interface VapiToolCall {
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface VapiMessage {
  type:
    | "function-call"
    | "status-update"
    | "end-of-call-report"
    | "assistant-request"
    | "transcript";
  call?: { id: string };
  toolCallList?: VapiToolCall[];
  functionCall?: {
    name: string;
    parameters: Record<string, string>;
  };
}
