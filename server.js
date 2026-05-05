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

// Хранилище всех подключённых клиентов
const clients = new Set();

io.on('connection', (socket) => {
  console.log(`🔌 Клиент подключился: ${socket.id}`);
  clients.add(socket);

  // Сообщаем новому клиенту его ID (необязательно)
  socket.emit('welcome', { id: socket.id });

  // Клиент сам сообщает, кто он: хост или гость
  socket.on('iam-host', () => {
    socket.isHost = true;
    console.log('🎬 Хост подключился');
    socket.emit('host-confirmed');
    // Отправляем хосту количество гостей
    const guestCount = [...clients].filter(c => !c.isHost).length;
    socket.emit('guests-count', guestCount);
  });

  socket.on('iam-guest', () => {
    socket.isGuest = true;
    console.log('👤 Гость подключился');
    socket.emit('guest-confirmed');
    // Уведомляем хоста об изменении количества гостей
    const hostClient = [...clients].find(c => c.isHost);
    if (hostClient) {
      const guestCount = [...clients].filter(c => !c.isHost).length;
      hostClient.emit('guests-count', guestCount);
    }
  });

  // --- Команды от хоста (рассылаем всем гостям) ---
  socket.on('start-show', () => {
    if (socket.isHost) {
      console.log('🎬 Рассылаем команду: start-show');
      [...clients].forEach(client => {
        if (!client.isHost) client.emit('start-show');
      });
    }
  });

  socket.on('thank-you', () => {
    if (socket.isHost) {
      console.log('❤️ Рассылаем команду: thank-you');
      [...clients].forEach(client => {
        if (!client.isHost) client.emit('thank-you');
      });
    }
  });

  socket.on('set-color', (color) => {
    if (socket.isHost) {
      console.log(`🎨 Рассылаем цвет: ${color}`);
      [...clients].forEach(client => {
        if (!client.isHost) client.emit('color-change', color);
      });
    }
  });

  socket.on('strobe-on', () => {
    if (socket.isHost) {
      console.log('⚡ Рассылаем: strobe-on');
      [...clients].forEach(client => {
        if (!client.isHost) client.emit('strobe-start');
      });
    }
  });

  socket.on('strobe-off', () => {
    if (socket.isHost) {
      console.log('⚡ Рассылаем: strobe-off');
      [...clients].forEach(client => {
        if (!client.isHost) client.emit('strobe-stop');
      });
    }
  });

  // --- Отключение ---
  socket.on('disconnect', () => {
    console.log(`❌ Клиент отключился: ${socket.id}`);
    clients.delete(socket);
    if (socket.isHost) {
      console.log('🏁 Хост отключился');
    } else if (socket.isGuest) {
      const hostClient = [...clients].find(c => c.isHost);
      if (hostClient) {
        const guestCount = [...clients].filter(c => !c.isHost).length;
        hostClient.emit('guests-count', guestCount);
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Хост: https://lights-stick-app-production.up.railway.app/host.html`);
  console.log(`🌐 Гость: https://lights-stick-app-production.up.railway.app/guest.html`);
});
