export type SseEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; text: string }
  | {
      type: "tool_start";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {
      type: "tool_end";
      toolCallId: string;
      toolName: string;
      summary: string;
    }
  | {
      type: "done";
      sessionId: string;
      sdkSessionId?: string;
      result?: string;
    }
  | { type: "error"; message: string };

export function formatSse(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
