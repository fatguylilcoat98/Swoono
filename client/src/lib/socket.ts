import { io, Socket } from "socket.io-client";
import { CLIENT_ID } from "./clientId";

// Re-export CLIENT_ID for backward compatibility
export { CLIENT_ID };

// In dev Vite proxies /socket.io -> :3001. In prod Express serves the
// websocket and the built client from the same origin.
const SOCKET_URL = import.meta.env.DEV ? "http://localhost:3001" : "/";

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (_socket) return _socket;
  
  _socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ["websocket", "polling"],
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 10000, // Add timeout for better error handling
  });
  
  // Add error handling
  _socket.on("connect_error", (error) => {
    console.warn("[swoono] Socket connection error:", error);
  });
  
  _socket.on("disconnect", (reason) => {
    console.warn("[swoono] Socket disconnected:", reason);
  });
  
  return _socket;
}
