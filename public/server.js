const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guest.html'));
});

let clients = 0;

io.on('connection', (socket) => {
  clients++;
  io.emit('clients-update', clients);
  console.log(`✅ Гостей онлайн: ${clients}`);

  socket.on('host-command', (data) => {
    console.log('Команда от хоста:', data);
    socket.broadcast.emit('command', data);
  });

  socket.on('disconnect', () => {
    clients--;
    io.emit('clients-update', clients);
    console.log(`❌ Гость ушел. Осталось: ${clients}`);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер работает на порту ${PORT}`);
});
