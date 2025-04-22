const socket = io();
let localStream;
let peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

async function joinRoom() {
  const room = document.getElementById("room").value;
  socket.emit("join", room);

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket.on("user-joined", async (id) => {
    peerConnection = createPeerConnection(id);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("signal", { to: id, signal: offer });
  });

  socket.on("signal", async ({ from, signal }) => {
    if (!peerConnection) {
      peerConnection = createPeerConnection(from);
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }

    if (signal.type === "offer") {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", { to: from, signal: answer });
    } else if (signal.type === "answer") {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
    }
  });
}

function createPeerConnection(remoteId) {
  const pc = new RTCPeerConnection(config);
  pc.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };
  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("signal", { to: remoteId, signal: event.candidate });
    }
  };
  return pc;
}
