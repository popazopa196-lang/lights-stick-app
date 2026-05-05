const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guest.html'));
});

let hostSocket = null;
const guests = new Set();
let showModeActive = false;     // Режим шоу (градиент выключен, текст скрыт)

io.on('connection', (socket) => {
  console.log(`🔌 Новое подключение: ${socket.id}`);

  // ---- Хост ----
  socket.on('host-connect', () => {
    if (hostSocket && hostSocket !== socket) {
      hostSocket.emit('host-replaced');
    }
    hostSocket = socket;
    socket.isHost = true;
    console.log('🎬 Хост зарегистрирован');
    socket.emit('host-connected', { success: true });
    socket.emit('guests-update', guests.size);
    // Отправляем текущий режим новому хосту (на всякий случай)
    socket.emit('mode-state', { showModeActive });
  });

  // ---- Гость ----
  socket.on('guest-connect', () => {
    socket.isGuest = true;
    guests.add(socket.id);
    console.log(`👤 Гость подключился. Всего: ${guests.size}`);
    
    // Отправляем новому гостю текущее состояние
    socket.emit('guest-connected', { success: true, showModeActive });
    if (showModeActive) {
      socket.emit('show-start');        // Сразу скрываем текст и убираем градиент
    }
    
    if (hostSocket) {
      hostSocket.emit('guests-update', guests.size);
    }
  });

  // ---- Команды от хоста ----
  socket.on('set-color', (color) => {
    if (socket.isHost && hostSocket === socket) {
      console.log(`🎨 Цвет ${color} → ${guests.size} гостей`);
      guests.forEach(guestId => {
        io.to(guestId).emit('color-change', color);
      });
    }
  });

  socket.on('strobe-on', () => {
    if (socket.isHost && hostSocket === socket) {
      console.log(`⚡ Стробоскоп ВКЛ`);
      guests.forEach(guestId => {
        io.to(guestId).emit('strobe-start');
      });
    }
  });

  socket.on('strobe-off', () => {
    if (socket.isHost && hostSocket === socket) {
      console.log(`⚡ Стробоскоп ВЫКЛ`);
      guests.forEach(guestId => {
        io.to(guestId).emit('strobe-stop');
      });
    }
  });

  socket.on('start-show', () => {
    if (socket.isHost && hostSocket === socket) {
      showModeActive = true;
      console.log(`🎬 Режим шоу АКТИВИРОВАН (градиент и текст выключены)`);
      guests.forEach(guestId => {
        io.to(guestId).emit('show-start');
      });
    }
  });

  // Новая кнопка "Спасибо"
  socket.on('show-thankyou', () => {
    if (socket.isHost && hostSocket === socket) {
      console.log(`💖 Показываем "Спасибо" на 5 секунд`);
      guests.forEach(guestId => {
        io.to(guestId).emit('show-thankyou');
      });
    }
  });

  // ---- Отключение ----
  socket.on('disconnect', () => {
    console.log(`❌ Отключился: ${socket.id}`);
    if (socket.isHost && hostSocket === socket) {
      hostSocket = null;
      showModeActive = false;
      console.log('🏁 Хост отключился, сбрасываем режим');
      guests.forEach(guestId => {
        io.to(guestId).emit('host-disconnected');
      });
    }
    if (socket.isGuest) {
      guests.delete(socket.id);
      console.log(`👋 Гость отключился. Осталось: ${guests.size}`);
      if (hostSocket) {
        hostSocket.emit('guests-update', guests.size);
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
