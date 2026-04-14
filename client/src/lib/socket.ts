import { io, Socket } from "socket.io-client";

function readClientId(): string {
  const KEY = "swoono:clientId";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export const CLIENT_ID = readClientId();

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
  });
  return _socket;
}
