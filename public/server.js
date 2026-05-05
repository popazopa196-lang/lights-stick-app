const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Ловим любой запрос, отдаём страницу гостя
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guest.html'));
});

let clients = 0;
let currentMessageIndex = 0;

// 🔥 ТВОИ СООБЩЕНИЯ (легко менять)
const messages = [
  "✨ РГУТИС ЭТО Я, РГУТИС ЭТО МЫ ✨",
  "🎤 НЕ ЗАБУДЬ ГРОМКО ПОДДЕРЖИВАТЬ ВЫСТУПАЮЩИХ 🎤",
  "💫 ТЫ ВЫГЛЯДИШЬ СНОГСШИБАТЕЛЬНО 💫",
  "😊 ХОРОШЕГО НАСТРОЕНИЯ! 😊",
  "🚀 МЫ СКОРО НАЧНЕМ 🚀"
];

function broadcastMessage() {
  io.emit('message-update', {
    text: messages[currentMessageIndex],
    index: currentMessageIndex
  });
}

io.on('connection', (socket) => {
  clients++;
  io.emit('clients-update', clients);
  console.log(`✅ Гость подключился, всего: ${clients}`);

  // Отправляем новому гостю текущую фразу
  socket.emit('message-update', {
    text: messages[currentMessageIndex],
    index: currentMessageIndex
  });

  socket.on('host-next-message', () => {
    currentMessageIndex = (currentMessageIndex + 1) % messages.length;
    broadcastMessage();
    console.log('Хост переключил фразу:', messages[currentMessageIndex]);
  });

  socket.on('host-prev-message', () => {
    currentMessageIndex = (currentMessageIndex - 1 + messages.length) % messages.length;
    broadcastMessage();
    console.log('Хост переключил фразу:', messages[currentMessageIndex]);
  });

  socket.on('disconnect', () => {
    clients--;
    io.emit('clients-update', clients);
    console.log(`❌ Гость ушёл, осталось: ${clients}`);
  });
});

// Порт изменён на 8080
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер работает на порту ${PORT}`);
  console.log(`💬 Начальная фраза: ${messages[0]}`);
});
