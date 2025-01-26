const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const http = require('http');

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store active rooms and their players
const rooms = new Map();

io.on('connection', (socket) => {
    let currentRoom = null;
    let playerId = null;

    socket.on('create_room', (data) => {
        // Generate a unique room ID
        const roomId = uuidv4().substring(0, 6).toUpperCase();
        rooms.set(roomId, {
            players: new Map(),
            readyCount: 0,
            inGame: false
        });
        currentRoom = roomId;
        playerId = uuidv4();
        
        // Add the player to the room
        rooms.get(roomId).players.set(playerId, {
            socket,
            name: data.playerName || 'Player 1',
            ready: false
        });

        socket.join(roomId);

        // Send room ID back to creator
        socket.emit('room_created', {
            roomId,
            playerId
        });
    });

    socket.on('join_room', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.players.size >= 8) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        if (room.inGame) {
            socket.emit('error', { message: 'Game already in progress' });
            return;
        }

        currentRoom = data.roomId;
        playerId = uuidv4();
        room.players.set(playerId, {
            socket,
            name: data.playerName || `Player ${room.players.size + 1}`,
            ready: false
        });

        socket.join(currentRoom);

        // Send success message to the joining player
        socket.emit('room_joined', {
            roomId: currentRoom,
            playerId
        });

        // Broadcast updated player list to all players in the room
        broadcastRoomState(currentRoom);
    });

    socket.on('update_name', (data) => {
        if (currentRoom && playerId) {
            const room = rooms.get(currentRoom);
            const player = room.players.get(playerId);
            if (player) {
                player.name = data.name;
                broadcastRoomState(currentRoom);
            }
        }
    });

    socket.on('player_ready', (data) => {
        if (currentRoom && playerId) {
            const room = rooms.get(currentRoom);
            const player = room.players.get(playerId);
            if (player) {
                player.ready = data.ready;
                room.readyCount = Array.from(room.players.values()).filter(p => p.ready).length;

                // Check if all players are ready (minimum 2 players)
                if (room.readyCount >= 2 && room.readyCount === room.players.size) {
                    room.inGame = true;
                    io.to(currentRoom).emit('game_start', {
                        players: Array.from(room.players.entries()).map(([id, p]) => ({
                            id,
                            name: p.name
                        }))
                    });
                } else {
                    broadcastRoomState(currentRoom);
                }
            }
        }
    });

    socket.on('game_update', (data) => {
        if (currentRoom) {
            socket.to(currentRoom).emit('game_update', {
                playerId,
                ...data.gameData
            });
        }
    });

    socket.on('player_defeated', (data) => {
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                // Check if only one player remains
                const activePlayers = Array.from(room.players.entries())
                    .filter(([id]) => id !== data.defeatedId);
                
                if (activePlayers.length === 1) {
                    // Declare winner
                    io.to(currentRoom).emit('game_over', {
                        winnerId: activePlayers[0][0],
                        winnerName: activePlayers[0][1].name
                    });
                    room.inGame = false;
                }
            }
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom && playerId) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.delete(playerId);
                if (room.players.size === 0) {
                    rooms.delete(currentRoom);
                } else {
                    broadcastRoomState(currentRoom);
                }
            }
        }
    });
});

function broadcastRoomState(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const roomState = {
        type: 'room_state',
        players: Array.from(room.players.entries()).map(([id, player]) => ({
            id,
            name: player.name,
            ready: player.ready
        }))
    };

    io.to(roomId).emit('room_state', roomState);
}

server.listen(8080, () => {
    console.log('Socket.IO server running on port 8080');
}); 