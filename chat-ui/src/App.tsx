import { useEffect } from "react";
import { ChatContainer } from "./components/ChatContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initFaro } from "./observability/faro";
import "./index.css";

export function App() {
  useEffect(() => {
    // Initialize Faro for observability
    initFaro();
  }, []);

  return (
    <ErrorBoundary>
      <ChatContainer />
    </ErrorBoundary>
  );
}

export default App;
