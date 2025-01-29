import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const BACKEND_URL = "https://d4ad-49-36-49-143.ngrok-free.app";

const Room = (props) => {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [isSharing, setIsSharing] = useState(false);
    const partnerVideo = useRef();
    const socketRef = useRef();
    const peerRef = useRef();
    const screenStream = useRef();

    useEffect(() => {
        // Connect to the deployed backend
        socketRef.current = io(BACKEND_URL, {
            transports: ['websocket'],
            cors: {
                origin: "*"
            }
        });

        socketRef.current.emit("join room", props.match.params.roomID);

        socketRef.current.on("room full", () => {
            alert("Room is full!");
            props.history.push('/');
        });

        socketRef.current.on("user left", () => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
            if (partnerVideo.current) {
                partnerVideo.current.srcObject = null;
            }
        });

        socketRef.current.on("other user", userID => {
            const peer = createPeer(userID, true);
            peerRef.current = peer;
        });

        socketRef.current.on("user joined", userID => {
            const peer = createPeer(userID, false);
            peerRef.current = peer;
        });

        socketRef.current.on("signal", payload => {
            peerRef.current.signal(payload.signal);
        });

        socketRef.current.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, [props.history]);

    function createPeer(userID, initiator) {
        const peer = new Peer({
            initiator,
            trickle: false
        });

        peer.on("signal", signal => {
            socketRef.current.emit("signal", { target: userID, signal });
        });

        peer.on("stream", stream => {
            partnerVideo.current.srcObject = stream;
        });

        peer.on("data", data => {
            setMessages(msgs => [...msgs, { text: String(data), fromMe: false }]);
        });

        return peer;
    }

    function shareScreen() {
        navigator.mediaDevices.getDisplayMedia({
            cursor: true,
            audio: false,
            video: true
        }).then(stream => {
            const screenTrack = stream.getVideoTracks()[0];
            screenStream.current = stream;
            
            if (peerRef.current) {
                peerRef.current.addStream(stream);
                setIsSharing(true);
                
                // Handle screen sharing stop from browser control
                screenTrack.onended = () => {
                    stopScreenShare();
                };
            }
        }).catch(err => {
            console.error("Error sharing screen:", err);
        });
    }

    function stopScreenShare() {
        if (screenStream.current) {
            screenStream.current.getTracks().forEach(track => track.stop());
            if (peerRef.current) {
                peerRef.current.removeStream(screenStream.current);
            }
            screenStream.current = null;
            setIsSharing(false);
        }
    }

    function sendMessage(e) {
        e.preventDefault();
        if (message.trim() && peerRef.current) {
            peerRef.current.send(message);
            setMessages(msgs => [...msgs, { text: message, fromMe: true }]);
            setMessage("");
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Header with controls */}
            <div style={{
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #dee2e6',
                display: 'flex',
                gap: '10px'
            }}>
                {!isSharing ? (
                    <button 
                        onClick={shareScreen}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Share Screen
                    </button>
                ) : (
                    <button 
                        onClick={stopScreenShare}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Stop Sharing
                    </button>
                )}
                <div style={{
                    marginLeft: 'auto',
                    padding: '8px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px'
                }}>
                    Room ID: {props.match.params.roomID}
                </div>
            </div>

            {/* Screen sharing area */}
            <div style={{ 
                height: '40vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '10px'
            }}>
                <video 
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        border: partnerVideo.current?.srcObject ? '2px solid #dee2e6' : 'none'
                    }} 
                    autoPlay 
                    ref={partnerVideo} 
                />
            </div>

            {/* Chat area */}
            <div style={{ 
                flex: 1,
                borderTop: '1px solid #ccc',
                display: 'flex',
                flexDirection: 'column',
                padding: '10px'
            }}>
                <div style={{ 
                    flex: 1,
                    marginBottom: '20px', 
                    overflow: 'auto',
                    padding: '10px'
                }}>
                    {messages.map((msg, idx) => (
                        <div key={idx} style={{
                            textAlign: msg.fromMe ? 'right' : 'left',
                            marginBottom: '10px'
                        }}>
                            <span style={{
                                background: msg.fromMe ? '#007bff' : '#e9ecef',
                                color: msg.fromMe ? 'white' : 'black',
                                padding: '5px 10px',
                                borderRadius: '10px',
                                display: 'inline-block',
                                maxWidth: '70%',
                                wordWrap: 'break-word'
                            }}>
                                {msg.text}
                            </span>
                        </div>
                    ))}
                </div>
                
                <form onSubmit={sendMessage} style={{ 
                    display: 'flex',
                    gap: '10px',
                    padding: '10px',
                    borderTop: '1px solid #dee2e6'
                }}>
                    <input 
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        style={{ 
                            flex: 1,
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ced4da'
                        }}
                        placeholder="Type a message..."
                    />
                    <button 
                        type="submit"
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Room;