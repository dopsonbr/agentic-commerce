import type { ChatEvent } from '../types/events';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { ToolCallCard } from './ToolCallCard';

interface Props {
  events: ChatEvent[];
}

export function MessageList({ events }: Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {events.map(event => {
        switch (event.type) {
          case 'user_message':
            return <UserMessage key={event.id} content={event.content} />;
          case 'assistant_message':
            return <AssistantMessage key={event.id} content={event.content} />;
          case 'tool_call': {
            // Find matching result
            const result = events.find(
              e => e.type === 'tool_result' && e.callId === event.callId
            );
            return (
              <ToolCallCard
                key={event.id}
                toolName={event.toolName}
                args={event.args}
                result={result?.type === 'tool_result' ? result : undefined}
              />
            );
          }
          case 'tool_result':
            return null; // Rendered with tool_call
          case 'error':
            return (
              <div key={event.id} className="text-red-500 p-2 bg-red-50 rounded">
                Error: {event.message}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
