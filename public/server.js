const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guest.html'));
});

// Хранилище комнат
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Новое подключение: ${socket.id}`);

  // ---- ХОСТ: создание комнаты ----
  socket.on('host-create-room', ({ code }) => {
    // Удаляем старую комнату этого хоста, если была
    for (let [roomCode, room] of rooms.entries()) {
      if (room.hostId === socket.id) {
        room.guests.forEach(guestId => {
          io.to(guestId).emit('host-left');
        });
        rooms.delete(roomCode);
        console.log(`🏚️ Старая комната ${roomCode} удалена`);
        break;
      }
    }
    
    rooms.set(code, {
      hostId: socket.id,
      guests: new Map(), // Map<guestId, {strobeActive: boolean}>
      currentMode: 'color',
      currentColor: '#ff3b30'
    });
    
    socket.join(`host-${code}`);
    console.log(`🏠 Хост создал комнату ${code}`);
    socket.emit('room-created', { code });
  });

  // ---- ГОСТЬ: подключение по коду ----
  socket.on('guest-join', ({ code }) => {
    const room = rooms.get(code);
    if (room && room.hostId) {
      room.guests.set(socket.id, { strobeActive: false });
      socket.join(`room-${code}`);
      socket.emit('join-success', { 
        currentMode: room.currentMode,
        currentColor: room.currentColor 
      });
      
      // Если в комнате активен стробоскоп, сразу его запускаем для нового гостя
      if (room.currentMode === 'strobe') {
        socket.emit('strobe-start');
        room.guests.set(socket.id, { strobeActive: true });
      }
      
      io.to(room.hostId).emit('guests-count', room.guests.size);
      console.log(`👤 Гость вошел в ${code}, всего: ${room.guests.size}`);
    } else {
      socket.emit('join-error', 'Комната не найдена');
    }
  });

  // ---- КОМАНДЫ ОТ ХОСТА ----
  
  // Смена цвета
  socket.on('host-color', ({ code, color }) => {
    const room = rooms.get(code);
    if (room && room.hostId === socket.id) {
      room.currentMode = 'color';
      room.currentColor = color;
      
      // Отключаем стробоскоп у всех гостей
      for (let [guestId, state] of room.guests.entries()) {
        if (state.strobeActive) {
          io.to(guestId).emit('strobe-stop');
          room.guests.set(guestId, { strobeActive: false });
        }
        io.to(guestId).emit('color-change', { color });
      }
      console.log(`🎨 Цвет ${color} в комнату ${code}, гостей: ${room.guests.size}`);
    }
  });
  
  // Включение стробоскопа
  socket.on('host-strobe-start', ({ code }) => {
    const room = rooms.get(code);
    if (room && room.hostId === socket.id) {
      room.currentMode = 'strobe';
      
      for (let [guestId, state] of room.guests.entries()) {
        if (!state.strobeActive) {
          io.to(guestId).emit('strobe-start');
          room.guests.set(guestId, { strobeActive: true });
        }
      }
      console.log(`⚡ Стробоскоп ВКЛЮЧЕН в комнате ${code}, гостей: ${room.guests.size}`);
    }
  });
  
  // Выключение стробоскопа (возврат к последнему цвету)
  socket.on('host-strobe-stop', ({ code }) => {
    const room = rooms.get(code);
    if (room && room.hostId === socket.id) {
      room.currentMode = 'color';
      
      for (let [guestId, state] of room.guests.entries()) {
        if (state.strobeActive) {
          io.to(guestId).emit('strobe-stop');
          io.to(guestId).emit('color-change', { color: room.currentColor });
          room.guests.set(guestId, { strobeActive: false });
        }
      }
      console.log(`⚡ Стробоскоп ВЫКЛЮЧЕН в комнате ${code}`);
    }
  });

  // ---- ОТКЛЮЧЕНИЕ ----
  socket.on('disconnect', () => {
    console.log(`❌ Отключение: ${socket.id}`);
    
    for (let [code, room] of rooms.entries()) {
      if (room.hostId === socket.id) {
        room.guests.forEach((_, guestId) => {
          io.to(guestId).emit('host-left');
        });
        rooms.delete(code);
        console.log(`🏚️ Комната ${code} закрыта (хост ушел)`);
        break;
      }
      
      if (room.guests.has(socket.id)) {
        room.guests.delete(socket.id);
        io.to(room.hostId).emit('guests-count', room.guests.size);
        console.log(`👋 Гость вышел из ${code}, осталось: ${room.guests.size}`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
