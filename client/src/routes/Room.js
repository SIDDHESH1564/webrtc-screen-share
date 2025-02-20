import React, { useRef, useEffect, useState, useCallback } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const BACKEND_URL = "https://1451-20-197-35-195.ngrok-free.app";

const Room = (props) => {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [peerConnected, setPeerConnected] = useState(false);
    
    const socketRef = useRef();
    const peerRef = useRef();
    const otherUserRef = useRef();

    const createPeer = useCallback((userID, initiator) => {
        console.log("Creating peer connection:", { userID, initiator });
        
        // Clean up existing peer if any
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        
        const peer = new Peer({
            initiator,
            trickle: false,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            }
        });

        peer.on("signal", signal => {
            console.log("Sending signal to:", userID, signal.type);
            if (socketRef.current) {
                socketRef.current.emit("signal", { target: userID, signal });
            }
        });

        peer.on("connect", () => {
            console.log("Peer connection established");
            setPeerConnected(true);
            try {
                peer.send(JSON.stringify({ type: 'connection-test' }));
            } catch (err) {
                console.error("Error sending test message:", err);
            }
        });

        peer.on("data", data => {
            try {
                const text = new TextDecoder().decode(data);
                setMessages(msgs => [...msgs, { text, fromMe: false }]);
            } catch (err) {
                console.error("Error processing message:", err);
            }
        });

        peer.on("error", err => {
            console.error("Peer connection error:", err);
            setPeerConnected(false);
        });

        peer.on("close", () => {
            console.log("Peer connection closed");
            setPeerConnected(false);
            // Try to reconnect if other user is still there
            if (otherUserRef.current) {
                setTimeout(() => {
                    createPeer(otherUserRef.current, true);
                }, 1000);
            }
        });

        peerRef.current = peer;
        return peer;
    }, []);

    const handleSignal = useCallback((payload) => {
        console.log("Received signal:", payload.signal.type);
        
        try {
            if (!peerRef.current) {
                console.log("Creating new peer for incoming signal");
                createPeer(payload.caller, false);
            }
            
            if (peerRef.current && !peerRef.current.destroyed) {
                peerRef.current.signal(payload.signal);
            }
        } catch (err) {
            console.error("Error processing signal:", err);
        }
    }, [createPeer]);

    useEffect(() => {
        socketRef.current = io(BACKEND_URL, {
            transports: ['websocket'],
            cors: { origin: "*" }
        });

        socketRef.current.emit("join room", props.match.params.roomID);

        socketRef.current.on("room full", () => {
            alert("Room is full!");
            props.history.push('/');
        });

        socketRef.current.on("user left", () => {
            console.log("User left the room");
            otherUserRef.current = null;
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
            setPeerConnected(false);
        });

        socketRef.current.on("other user", userID => {
            console.log("Found other user:", userID);
            otherUserRef.current = userID;
            createPeer(userID, true);
        });

        socketRef.current.on("user joined", userID => {
            console.log("New user joined:", userID);
            otherUserRef.current = userID;
        });

        socketRef.current.on("signal", handleSignal);

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, [props.history, props.match.params.roomID, createPeer, handleSignal]);

    const sendMessage = useCallback((e) => {
        e.preventDefault();
        if (!message.trim()) return;

        if (!peerRef.current || !peerConnected) {
            alert("Waiting for peer connection...");
            return;
        }

        try {
            peerRef.current.send(message);
            setMessages(msgs => [...msgs, { text: message, fromMe: true }]);
            setMessage("");
        } catch (err) {
            console.error("Error sending message:", err);
            alert("Failed to send message. Connection may be lost.");
            setPeerConnected(false);
        }
    }, [message, peerConnected]);

    return (
        <div className="flex flex-col h-screen">
            {!peerConnected && (
                <div className="bg-yellow-100 p-2 text-center">
                    Establishing secure connection...
                </div>
            )}

            <div className="flex-1 overflow-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                                msg.fromMe 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 text-gray-800'
                            }`}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t p-4">
                <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder={peerConnected ? "Type a message..." : "Waiting for connection..."}
                        className="flex-1 rounded border p-2"
                        disabled={!peerConnected}
                    />
                    <button
                        type="submit"
                        className={`px-4 py-2 rounded ${
                            peerConnected 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        disabled={!peerConnected}
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Room;