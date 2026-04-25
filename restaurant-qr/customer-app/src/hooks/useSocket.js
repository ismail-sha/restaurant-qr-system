import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export function useSocket(tableId) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!tableId) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_table', { tableId });
    });

    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.disconnect();
    };
  }, [tableId]);

  const on = (event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  };

  const emit = (event, data) => {
    socketRef.current?.emit(event, data);
  };

  return { socket: socketRef.current, isConnected, on, emit };
}
