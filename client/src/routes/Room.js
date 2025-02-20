import React, { useRef, useEffect } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const Room = (props) => {
    const userVideo = useRef();
    const partnerVideo = useRef();
    const socketRef = useRef();
    const userStream = useRef();
    const peerRef = useRef();

    useEffect(() => {
        // Only get audio stream initially
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
            userStream.current = stream;

            socketRef.current = io.connect("/");
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
        });

        // Cleanup on component unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (peerRef.current) {
                peerRef.current.destroy();
            }
            if (userStream.current) {
                userStream.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [props.history]);

    function createPeer(userID, initiator) {
        const peer = new Peer({
            initiator,
            trickle: false,
            stream: userStream.current
        });

        peer.on("signal", signal => {
            socketRef.current.emit("signal", { target: userID, signal });
        });

        peer.on("stream", stream => {
            partnerVideo.current.srcObject = stream;
        });

        return peer;
    }

    function shareScreen() {
        navigator.mediaDevices.getDisplayMedia({ cursor: true }).then(stream => {
            const screenTrack = stream.getTracks()[0];
            
            if (peerRef.current) {
                // Add screen track to peer connection
                peerRef.current.addTrack(screenTrack, stream);

                // Show screen share in local video
                userVideo.current.srcObject = stream;

                screenTrack.onended = () => {
                    // Remove screen sharing track when ended
                    peerRef.current.removeTrack(
                        peerRef.current.getSenders().find(sender => 
                            sender.track.kind === "video"
                        )
                    );
                    
                    // Clear local video display
                    userVideo.current.srcObject = null;
                };
            }
        }).catch(err => {
            console.error("Error sharing screen:", err);
        });
    }

    return (
        <div>
            <video controls style={{height: 500, width: 500, display: 'none'}} autoPlay ref={userVideo} muted />
            <video controls style={{height: 500, width: 500}} autoPlay ref={partnerVideo} />
            <button onClick={shareScreen}>Share screen</button>
        </div>
    );
};

export default Room;