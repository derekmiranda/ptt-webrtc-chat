let conn;
let socket;
let peerId = null;
let initiatedConn = false;

const mediaConstraints = {
  audio: false,
  video: true,
};

document.addEventListener('readystatechange', function() {
  if (document.readyState !== 'complete') return;

  // Instantiate Socket.io client
  window.socket = socket = io();

  const call = document.getElementById('call');

  call.addEventListener('click', startCall);

  socket.on('message', console.log.bind(console))

  /**
   * WebRTC Signaling Event Handlers
   */

  // For receiving offer from an initiating peer and sent by server
  socket.on('offer', (initiatorId, offer) => {
    console.log('Received offer');

    if (initiatedConn) return;
    initiatedConn = true;

    // save peerId
    peerId = initiatorId;

    // Create RTCPeerConnection and set up WebRTC-related event handlers
    genPeerConn();

    conn.setRemoteDescription(offer)
      .then(() => navigator.mediaDevices.getUserMedia(mediaConstraints))
      // Play stream
      .then((stream) => {
        document.getElementById('local_video').srcObject = stream;
        return conn.addStream(stream);
      })
      .then(() => conn.createAnswer())
      .then(answer => conn.setLocalDescription(answer))
      .then(() => {
        console.log('Sending answer to server...')
        socket.emit('answer', initiatorId, conn.localDescription);
      })
      .catch(logError);
  });

  // For receiving answer from a receiver this peer has called
  socket.on('answer', (receiverId, answer) => {
    console.log('Received answer');

    // save peerId
    peerId = receiverId;

    conn.setRemoteDescription(answer).catch(logError);
  });

  // For receiving an ICE candidate (an IP address needed to talk w/ peer) and registering it
  socket.on('candidate', (candidate) => {
    console.log('Received candidate');
    conn.addIceCandidate(candidate).catch(logError);
  });
});

/**
 * RTC Peer Connection setup
 */
function genPeerConn() {
  conn = new RTCPeerConnection({
      iceServers: [
        // Default STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ]
    });

  conn.onnegotiationneeded = () => {
    if (initiatedConn) return;
    initiatedConn = true;
    conn.createOffer()
      .then((offer) => conn.setLocalDescription(offer))
      .then(() => {
        const offer = conn.localDescription;
        console.log('Sending offer to server...');
        socket.emit('offer', offer);
      })
      .catch(logError);
  }

  conn.onicecandidate = (event) => {
    if (peerId) {
      console.log('Sending candidate to server...');
      socket.emit('candidate', peerId, event.candidate);
    } 
  }

  conn.onaddstream = (event) => {
    document.getElementById('remote_video').srcObject = event.stream;
    document.getElementById('hangup').disabled = false;
  }

  conn.oniceconnectionstatechange = (event) => {
    console.log('ICE connection state -> ' + conn.iceConnectionState);
  }

  conn.onsignalingstatechange = (event) => {
    console.log('Signaling state -> ' + conn.signalingState);
  }
}

/**
 * Play button click handler - starts recording video from webcam,
 * dislays it in one video tag,
 * then adds the stream to the RTC Peer Connection, 
 * which initiates the connection process
 */
function startCall(event) {
  if (conn) return window.alert('Already have a call open, dude.');
  
  console.log('Starting call...');
  
  genPeerConn();

  navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then((localStream) => {
      document.getElementById('local_video').srcObject = localStream;
      conn.addStream(localStream);
    })
    .catch(logError);
}

function logError(e) {
  console.error(e);
}