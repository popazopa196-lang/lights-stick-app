const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guest.html'));
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`✅ Подключился: ${socket.id}`);

  // Хост создаёт комнату
  socket.on('host-register', (code) => {
    socket.hostCode = code;
    rooms.set(code, { host: socket.id, guests: [] });
    console.log(`🏠 Комната ${code} создана`);
    socket.emit('registered');
  });

  // Гость подключается
  socket.on('guest-join', (code) => {
    const room = rooms.get(code);
    if (room && room.host) {
      room.guests.push(socket.id);
      socket.join(`room-${code}`);
      socket.emit('join-success');
      io.to(room.host).emit('guest-count', room.guests.length);
      console.log(`👤 Гость в ${code}, всего: ${room.guests.length}`);
    } else {
      socket.emit('join-error');
    }
  });

  // Цвет от хоста
  socket.on('color-command', ({ code, color }) => {
    const room = rooms.get(code);
    if (room && room.host === socket.id) {
      io.to(`room-${code}`).emit('set-color', color);
      console.log(`🎨 Цвет ${color} в ${code}`);
    }
  });

  // Стробоскоп
  socket.on('strobe-command', ({ code, active }) => {
    const room = rooms.get(code);
    if (room && room.host === socket.id) {
      io.to(`room-${code}`).emit('set-strobe', active);
      console.log(`⚡ Стробоскоп ${active ? 'ВКЛ' : 'ВЫКЛ'} в ${code}`);
    }
  });

  // Начать шоу
  socket.on('start-show-command', (code) => {
    const room = rooms.get(code);
    if (room && room.host === socket.id) {
      io.to(`room-${code}`).emit('start-show');
      console.log(`🎬 Шоу началось в ${code}`);
    }
  });

  socket.on('disconnect', () => {
    for (let [code, room] of rooms.entries()) {
      if (room.host === socket.id) {
        rooms.delete(code);
        console.log(`🏚️ Комната ${code} закрыта`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер на порту ${PORT}`);
});
