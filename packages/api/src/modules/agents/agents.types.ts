import type { DecisionAgent } from '@api/modules/simulation/simulation.types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
}

export interface LlmChoice {
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: string;
}

export interface LlmResponse {
  choices: LlmChoice[];
}

export interface LlmClient {
  chat(request: LlmRequest): Promise<LlmResponse>;
}

export interface PromptEntry {
  version: string;
  agent: DecisionAgent;
  system: string;
}
