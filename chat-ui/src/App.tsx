import { useEffect } from "react";
import { ChatContainer } from "./components/ChatContainer";
import { initFaro } from "./observability/faro";
import "./index.css";

export function App() {
  useEffect(() => {
    // Initialize Faro for observability
    initFaro();
  }, []);

  return <ChatContainer />;
}

export default App;
