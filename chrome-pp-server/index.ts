const clients = new Set<any>();
type Room = {
    clients: Set<any>;
    url: string;
}
const rooms = new Map<string, Room>(); // Map to store rooms and their clients

const server = Bun.serve({
    fetch(req, server) {
        if (server.upgrade(req)) {
            return;
        }
        return new Response("Upgrade failed", { status: 500 });
    },
    websocket: {
        message(ws, message) {
            const data = JSON.parse(message.toString());
            const { type, roomId, content } = data;

            if (type === "join") {
                console.log(ws);
                // Client wants to join a room
                if (!rooms.has(roomId) && content) {
                    // Create a new room if it doesn't exist
                    rooms.set(roomId, {
                        clients: new Set(),
                        url: content
                    });
                }
                // Add the client to the room
                const room = rooms.get(roomId);
                if (!room) {
                    console.error(`Room ${roomId} was not created`);
                    return;
                }
                room.clients.add(ws);
                ws.send(JSON.stringify({ type: "joined", roomId, url: room.url }));
                console.log(`Client joined room: ${roomId}`);
            } else if (type === "message" && roomId) {
                // Broadcast message to all clients in the room except the sender
                const roomClients = rooms.get(roomId);
                if (roomClients) {
                    for (const client of roomClients.clients) {
                        if (client !== ws) {
                            client.send(JSON.stringify({ type: "message", roomId, content }));
                        }
                    }
                }
                console.log(`Message to room ${roomId}: ${content}`);
            } else {
                console.log("Received unknown message type or missing roomId");
            }
        },
        open(ws) {
            console.log("WebSocket opened.");
            clients.add(ws);
        },
        close(ws, code, _reason) {
            console.log("Close WebSocket. Code: " + code);
            clients.delete(ws);
            // Remove the client from any rooms they were part of
            for (const [roomId, room] of rooms.entries()) {
                room.clients.delete(ws);
                if (room.clients.size === 0) {
                    rooms.delete(roomId); // Delete the room if it becomes empty
                }
            }
        }
    }
});

console.log(`Listening on ${server.hostname}:${server.port}`);
