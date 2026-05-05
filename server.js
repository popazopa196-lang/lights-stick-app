const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Раздаём статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Ключевое правило для SPA (чтобы не было ошибки "Not Found" при обновлении)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guest.html'));
});

let clients = 0;

io.on('connection', (socket) => {
  clients++;
  io.emit('clients-update', clients);
  console.log(`✅ Гостей онлайн: ${clients}`);

  socket.on('host-command', (data) => {
    socket.broadcast.emit('command', data);
  });

  socket.on('disconnect', () => {
    clients--;
    io.emit('clients-update', clients);
    console.log(`❌ Гость ушел. Гостей онлайн: ${clients}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер работает на порту ${PORT}`);
});