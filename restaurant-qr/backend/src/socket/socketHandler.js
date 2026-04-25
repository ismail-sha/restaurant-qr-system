const socketHandler = (io) => {
  // Track connected clients
  const connectedClients = {
    kitchen: new Set(),
    tables: {}, // tableId -> Set of socketIds
  };

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ─── Customer joins their table room ───────────────────────────────────
    socket.on('join_table', ({ tableId }) => {
      const room = `table_${tableId}`;
      socket.join(room);
      socket.tableId = tableId;
      socket.clientType = 'customer';

      if (!connectedClients.tables[tableId]) {
        connectedClients.tables[tableId] = new Set();
      }
      connectedClients.tables[tableId].add(socket.id);

      console.log(`🪑 Customer joined Table ${tableId} (room: ${room})`);
      socket.emit('joined_table', { tableId, room });
    });

    // ─── Kitchen staff joins the kitchen room ──────────────────────────────
    socket.on('join_kitchen', ({ staffId }) => {
      socket.join('kitchen');
      socket.staffId = staffId;
      socket.clientType = 'kitchen';
      connectedClients.kitchen.add(socket.id);

      console.log(`👨‍🍳 Kitchen staff joined (staffId: ${staffId})`);
      socket.emit('joined_kitchen', { message: 'Connected to kitchen dashboard' });

      // Send current stats to kitchen
      io.to('kitchen').emit('kitchen_stats', getStats(connectedClients));
    });

    // ─── Kitchen updates order status ──────────────────────────────────────
    socket.on('update_order_status', ({ orderId, tableId, newStatus, estimatedTime }) => {
      console.log(`📋 Order ${orderId} → ${newStatus} (Table ${tableId})`);

      // Notify the specific table
      io.to(`table_${tableId}`).emit('order_status_update', {
        orderId,
        status: newStatus,
        estimatedTime,
        updatedAt: new Date().toISOString(),
      });

      // Notify all kitchen screens
      io.to('kitchen').emit('order_updated', {
        orderId,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    });

    // ─── New order placed (broadcast to kitchen) ───────────────────────────
    socket.on('new_order_placed', ({ order }) => {
      console.log(`🛒 New order from Table ${order.tableId}: #${order.id}`);
      io.to('kitchen').emit('new_order', { order });
      io.to('kitchen').emit('kitchen_notification', {
        type: 'new_order',
        message: `New order from Table ${order.tableNumber}!`,
        orderId: order.id,
      });
    });

    // ─── Kitchen sends estimated time update ───────────────────────────────
    socket.on('send_time_update', ({ tableId, orderId, estimatedMinutes }) => {
      io.to(`table_${tableId}`).emit('time_updated', {
        orderId,
        estimatedMinutes,
        updatedAt: new Date().toISOString(),
      });
    });

    // ─── Kitchen marks item ready ──────────────────────────────────────────
    socket.on('item_ready', ({ tableId, orderId, itemName }) => {
      io.to(`table_${tableId}`).emit('item_ready_notification', {
        orderId,
        itemName,
        message: `${itemName} is ready!`,
      });
    });

    // ─── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      if (socket.clientType === 'kitchen') {
        connectedClients.kitchen.delete(socket.id);
      } else if (socket.clientType === 'customer' && socket.tableId) {
        const tableSet = connectedClients.tables[socket.tableId];
        if (tableSet) tableSet.delete(socket.id);
      }
    });
  });
};

function getStats(connectedClients) {
  return {
    kitchenClients: connectedClients.kitchen.size,
    activeTables: Object.entries(connectedClients.tables)
      .filter(([, set]) => set.size > 0)
      .map(([tableId]) => tableId),
  };
}

module.exports = socketHandler;
