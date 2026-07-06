import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Establish a global Socket.io connection to the API gateway.
 * Optionally joins a package-scoped room for real-time updates.
 * Sprint 1: connection only. Event handlers wired in later sprints.
 */
export function useSocketConnection(packageId?: string): Socket | null {
  useEffect(() => {
    if (!socket) {
      socket = io('/', {
        transports: ['websocket'],
        autoConnect: true,
      });

      socket.on('connect', () => {
        console.log('[socket] connected', socket?.id);
      });

      socket.on('disconnect', (reason) => {
        console.log('[socket] disconnected', reason);
      });

      socket.on('connect_error', (err) => {
        console.warn('[socket] connect_error', err.message);
      });
    }

    if (packageId && socket.connected) {
      socket.emit('join_package', packageId);
    }

    return () => {
      // Keep singleton alive across navigations
    };
  }, [packageId]);

  return socket;
}
