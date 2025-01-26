const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);

const rooms = {};

io.on("connection", socket => {
    socket.on("join room", roomID => {
        // Remove user from any other rooms they might be in
        removeUserFromAllRooms(socket.id);

        if (rooms[roomID]) {
            // Only allow 2 users per room
            if (rooms[roomID].length < 2) {
                rooms[roomID].push(socket.id);
            } else {
                // Room is full
                socket.emit("room full");
                return;
            }
        } else {
            rooms[roomID] = [socket.id];
        }

        const otherUser = rooms[roomID].find(id => id !== socket.id);
        if (otherUser) {
            socket.emit("other user", otherUser);
            socket.to(otherUser).emit("user joined", socket.id);
        }

        // Log room state
        console.log(`Room ${roomID}:`, rooms[roomID]);
    });

    socket.on("signal", payload => {
        io.to(payload.target).emit("signal", {
            signal: payload.signal,
            caller: socket.id
        });
    });

    socket.on("disconnect", () => {
        removeUserFromAllRooms(socket.id);
    });
});

function removeUserFromAllRooms(socketId) {
    // Find all rooms this user is in
    for (let roomID in rooms) {
        const room = rooms[roomID];
        
        // Remove user from room
        const index = room.indexOf(socketId);
        if (index > -1) {
            room.splice(index, 1);
            
            // Notify other user in the room
            const otherUser = room[0];
            if (otherUser) {
                io.to(otherUser).emit("user left");
            }
        }

        // Remove room if empty
        if (room.length === 0) {
            delete rooms[roomID];
        }
    }
    // Log rooms state after cleanup
    console.log("Rooms after cleanup:", rooms);
}

server.listen(8000, () => console.log('server is running on port 8000'));
