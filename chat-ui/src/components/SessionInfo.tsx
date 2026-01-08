interface Props {
  sessionId: string;
  customerId: string | null;
  onReset?: () => void;
}

export function SessionInfo({ sessionId, customerId, onReset }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="font-bold mb-3">Session</h3>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Session:</span>
          <span className="font-mono text-xs">{sessionId.slice(0, 12)}...</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Customer:</span>
          <span>{customerId || '(not set)'}</span>
        </div>
      </div>
      {onReset && (
        <button
          onClick={onReset}
          className="mt-3 w-full text-sm text-red-600 hover:text-red-700 border border-red-200 rounded py-1 hover:bg-red-50 transition-colors"
        >
          Reset Session
        </button>
      )}
    </div>
  );
}
