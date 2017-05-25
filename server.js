const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('./public'));

app.get('/', (req, res) => {
  return res.sendFile(__dirname + '/public/index.html');
})

const server = app.listen(PORT, () => console.log('Listening on port ' + PORT));

const io = require('socket.io')(server);

io.on('connection', function (socket) {
  console.log('New connection:', socket.id);

  /**
   * WebRTC Signaling Handlers - facilitate exchange of information b/w peers
   */

  // receive offer from initiator and send to receiver along w/ initiator's socket id
  socket.on('offer', function (offer) {
    // check if any clients
    io.clients((err, clients) => {
      if (err) throw err;

      const otherClients = clients.filter(id => id !== this.id);
      if (otherClients.length) {
        // console.log('there');
        const initiatorId = this.id;
        const receiverId = otherClients[0];
        socket.to(receiverId).emit('offer', initiatorId, offer);
      } else {
        socket.emit('message', 'No other clients to connect to');
      }
    });
  });

  // receive answers from receivers and send to initiators along w/ receiver's socket id
  socket.on('answer', function (initiatorId, answer) {
    const receiverId = this.id;
    console.log('Emitting answer...');
    socket.to(initiatorId).emit('answer', receiverId, answer);
  });

  // send peers in a WebRTC connection new ICE candidates
  socket.on('candidate', function (peerId, candidate) {
    console.log('Emitting ICE candidate...');
    socket.to(peerId).emit('candidate', candidate);
  });

  // tell other peers to close video when one hangs up
  socket.on('hangup', (peerId) => {
    // if (!peerId) return;
    console.log('Hang up');

    socket.to(peerId).emit('hangup');
  });
});