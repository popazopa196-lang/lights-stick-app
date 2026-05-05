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

// Хранилище комнат: код комнаты -> массив сокетов гостей
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Новое подключение');

  // Хост устанавливает код комнаты
  socket.on('host-set-room', ({ code }) => {
    socket.hostRoom = code;
    if (!rooms.has(code)) {
      rooms.set(code, { host: socket.id, guests: new Set() });
    } else {
      rooms.get(code).host = socket.id;
    }
    console.log(`🏠 Хост создал/обновил комнату ${code}`);
  });

  // Гость пытается войти по коду
  socket.on('guest-join', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (room && room.host) {
      socket.guestRoom = roomCode;
      room.guests.add(socket.id);
      socket.emit('join-success');
      // Обновляем счетчик для хоста
      io.to(room.host).emit('clients-update', room.guests.size);
      console.log(`👤 Гость вошел в комнату ${roomCode}, всего гостей: ${room.guests.size}`);
    } else {
      socket.emit('join-error', 'Комната не найдена');
    }
  });

  // Команда от хоста своим гостям
  socket.on('host-command', ({ mode, value, roomCode }) => {
    const room = rooms.get(roomCode);
    if (room && room.host === socket.id) {
      room.guests.forEach(guestId => {
        io.to(guestId).emit('command', { mode, value });
      });
      console.log(`📡 Команда ${mode}:${value} в комнату ${roomCode}`);
    }
  });

  socket.on('disconnect', () => {
    // Если отключился хост
    for (let [code, room] of rooms.entries()) {
      if (room.host === socket.id) {
        // Отключаем всех гостей в этой комнате
        room.guests.forEach(guestId => {
          io.to(guestId).emit('host-disconnected');
        });
        rooms.delete(code);
        console.log(`🏚️ Комната ${code} закрыта (хост ушел)`);
        break;
      }
      // Если отключился гость
      if (room.guests.has(socket.id)) {
        room.guests.delete(socket.id);
        if (room.host) {
          io.to(room.host).emit('clients-update', room.guests.size);
        }
        console.log(`👋 Гостя в комнате ${code} осталось: ${room.guests.size}`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер работает на порту ${PORT}`);
});
