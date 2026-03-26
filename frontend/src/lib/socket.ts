import { io } from "socket.io-client";

// Use the same hostname the browser is on (works for both localhost and LAN IP)
const SOCKET_URL = `${window.location.protocol}//${window.location.hostname}:3000`;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
