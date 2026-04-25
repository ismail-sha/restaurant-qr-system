import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export function useKitchenSocket(staffId) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!staffId) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_kitchen', { staffId });
      console.log('🍳 Kitchen socket connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('🔌 Kitchen socket disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket error:', err.message);
    });

    // Re-attach stored listeners
    Object.entries(listenersRef.current).forEach(([event, handlers]) => {
      handlers.forEach(h => socket.on(event, h));
    });

    return () => {
      socket.disconnect();
    };
  }, [staffId]);

  const on = (event, handler) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = [];
    listenersRef.current[event].push(handler);
    socketRef.current?.on(event, handler);

    return () => {
      listenersRef.current[event] = (listenersRef.current[event] || []).filter(h => h !== handler);
      socketRef.current?.off(event, handler);
    };
  };

  const emit = (event, data) => socketRef.current?.emit(event, data);

  return { isConnected, on, emit };
}
