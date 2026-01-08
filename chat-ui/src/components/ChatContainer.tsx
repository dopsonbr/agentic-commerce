import { useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { CartSummary } from './CartSummary';
import { SessionInfo } from './SessionInfo';

export function ChatContainer() {
  const { events, sessionId, customerId, cart, isProcessing, sendMessage, resetSession } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Conversation Panel */}
      <div className="flex-1 flex flex-col bg-white">
        <header className="border-b p-4 flex-shrink-0">
          <h1 className="text-xl font-bold">Agentic Shopping Chat</h1>
          <p className="text-sm text-gray-500">Scripted Agent Mode</p>
        </header>

        <div className="flex-1 overflow-y-auto">
          <MessageList events={events} />
          <div ref={messagesEndRef} />
        </div>

        <MessageInput onSend={sendMessage} disabled={isProcessing} />
      </div>

      {/* Context Panel */}
      <div className="w-80 border-l bg-gray-50 p-4 space-y-4 flex-shrink-0">
        <CartSummary cart={cart} />
        <SessionInfo sessionId={sessionId} customerId={customerId} onReset={resetSession} />

        {/* Quick tips */}
        <div className="border rounded-lg p-4 bg-white">
          <h3 className="font-bold mb-3">Try saying...</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>"my customer id is 123456"</li>
            <li>"show me hammers"</li>
            <li>"add it to my cart"</li>
            <li>"what's in my cart"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
