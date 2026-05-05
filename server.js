const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Раздаём статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Все запросы направляем на guest.html (чтобы не было 404)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guest.html'));
});

// Хранилище подключений
let hostSocket = null;
const guests = new Set();

io.on('connection', (socket) => {
  console.log(`🔌 Новое подключение: ${socket.id}`);

  // ---- Хост подключается ----
  socket.on('host-connect', () => {
    // Если был старый хост — отключаем его
    if (hostSocket && hostSocket !== socket) {
      hostSocket.emit('host-replaced');
    }
    hostSocket = socket;
    socket.isHost = true;
    console.log('🎬 Хост подключился и зарегистрирован');
    socket.emit('host-connected', { success: true });
    // Отправляем текущее количество гостей
    socket.emit('guests-update', guests.size);
  });

  // ---- Гость подключается ----
  socket.on('guest-connect', () => {
    socket.isGuest = true;
    guests.add(socket.id);
    console.log(`👤 Гость подключился. Всего: ${guests.size}`);
    socket.emit('guest-connected', { success: true });
    // Уведомляем хоста
    if (hostSocket) {
      hostSocket.emit('guests-update', guests.size);
    }
  });

  // ---- Команды от хоста ----
  socket.on('set-color', (color) => {
    if (socket.isHost && hostSocket === socket) {
      console.log(`🎨 Рассылаем цвет: ${color} для ${guests.size} гостей`);
      guests.forEach(guestId => {
        io.to(guestId).emit('color-change', color);
      });
    }
  });

  socket.on('strobe-on', () => {
    if (socket.isHost && hostSocket === socket) {
      console.log(`⚡ Рассылаем: стробоскоп ВКЛ`);
      guests.forEach(guestId => {
        io.to(guestId).emit('strobe-start');
      });
    }
  });

  socket.on('strobe-off', () => {
    if (socket.isHost && hostSocket === socket) {
      console.log(`⚡ Рассылаем: стробоскоп ВЫКЛ`);
      guests.forEach(guestId => {
        io.to(guestId).emit('strobe-stop');
      });
    }
  });

  socket.on('start-show', () => {
    if (socket.isHost && hostSocket === socket) {
      console.log(`🎬 Рассылаем: начать шоу (скрыть текст)`);
      guests.forEach(guestId => {
        io.to(guestId).emit('show-start');
      });
    }
  });

  // ---- Отключение ----
  socket.on('disconnect', () => {
    console.log(`❌ Отключился: ${socket.id}`);
    
    if (socket.isHost && hostSocket === socket) {
      hostSocket = null;
      console.log('🏁 Хост отключился');
      // Уведомляем гостей
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

// Запуск сервера
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер успешно запущен на порту ${PORT}`);
  console.log(`🌐 Страница хоста: http://localhost:${PORT}/host.html`);
  console.log(`🌐 Страница гостя: http://localhost:${PORT}/guest.html`);
});
