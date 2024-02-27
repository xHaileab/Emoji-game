require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(cors(corsOptions));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store game sessions with details

const gameSessions = {};
const waitingPlayers = [];

function generateEmojiSet() {
  const emojiSet = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍"];
  return emojiSet;
}

function shuffleAndDuplicateEmojis(emojiSet) {
  let emojis = [...emojiSet];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  emojis.push(randomEmoji);

  emojis.sort(() => Math.random() - 0.5);
  return emojis.slice(0, 16);
}

// function initializeGame(sessionId) {
//   const emojiSet = generateEmojiSet();
//   gameSessions[sessionId] = {
//     emojis: shuffleAndDuplicateEmojis(emojiSet),
//     selectedEmojis: [],
//     score: 0,
//     timeLeft: 60,
//     players: [],
//   };
// }

function initializeGame(sessionId) {
  const emojiSet = generateEmojiSet();
  gameSessions[sessionId] = {
    emojis: shuffleAndDuplicateEmojis(emojiSet),
    selectedEmojis: [],
    scores: { playerOne: 0, playerTwo: 0 },
    timeLeft: 60,
    players: [],
    timer: null
  };
}



function startCountdown(sessionId) {
  gameSessions[sessionId].timer = setInterval(() => {
    if (gameSessions[sessionId].timeLeft > 0) {
      gameSessions[sessionId].timeLeft--;
      io.to(sessionId).emit('timeUpdate', { timeLeft: gameSessions[sessionId].timeLeft });
    } else {
      clearInterval(gameSessions[sessionId].timer);
      io.to(sessionId).emit('endGame', gameSessions[sessionId]);
    }
  }, 1000);
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('startGame', () => {
    waitingPlayers.push(socket.id);
    console.log('Current waiting players:', waitingPlayers);

    if (waitingPlayers.length >= 2) {
      const playerOneId = waitingPlayers.shift();
      const playerTwoId = waitingPlayers.shift();
      const sessionId = 'session_' + Date.now();

      initializeGame(sessionId);

      io.to(playerOneId).socketsJoin(sessionId);
      io.to(playerTwoId).socketsJoin(sessionId);

      gameSessions[sessionId].players.push(playerOneId, playerTwoId);

      io.to(sessionId).emit('gameStarted', gameSessions[sessionId]);

      startCountdown(sessionId);

    } else {

      io.to(socket.id).emit('waitingForPlayer');
    }
  });

  socket.on('selectEmoji', ({ sessionId, emojiIndex }) => {
    const gameSession = gameSessions[sessionId];
    if (!gameSession) {
      console.error(`Session ${sessionId} not found`);
      return;
    }
    if (gameSession.selectedEmojis.length < 2 && !gameSession.selectedEmojis.includes(emojiIndex)) {
      gameSession.selectedEmojis.push(emojiIndex);
      if (gameSession.selectedEmojis.length === 2) {
        const [firstIndex, secondIndex] = gameSession.selectedEmojis;
        if (gameSession.emojis[firstIndex] === gameSession.emojis[secondIndex]) {
          const playerIndex = gameSession.players.indexOf(socket.id);
          const playerKey = playerIndex === 0 ? 'playerOne' : 'playerTwo';
          gameSession.scores[playerKey] += 1; // Update the score

          // Reset selected emojis for the next turn
          gameSession.selectedEmojis = [];

          gameSession.score++;
          gameSession.emojis = shuffleAndDuplicateEmojis(generateEmojiSet());
          
        // Inside your event handler where a score might change
const updateScores = (sessionId, playerId) => {
  // This is a simplified example. You'll adjust it based on your game logic.
  const gameSession = gameSessions[sessionId];
  if (!gameSession) {
    console.error(`Session ${sessionId} not found`);
    return;
  }

  // Assuming you identify players as playerOne and playerTwo in your session object
  const playerKey = gameSession.players[0] === playerId ? 'playerOne' : 'playerTwo';
  gameSession.scores[playerKey] += 1; // Increment the score for the correct player

  // Then broadcast the updated scores to all players in the session
  io.to(sessionId).emit('scoreUpdate', gameSession.scores);
};
          io.to(sessionId).emit('matchFound', { index1: firstIndex, index2: secondIndex, scores: gameSession.scores, emojis: gameSession.emojis });
          if (gameSessions[sessionId].timeLeft <= 0) {
            clearInterval(gameSessions[sessionId].timer);
            io.to(sessionId).emit('endGame', { scores: gameSessions[sessionId].scores });
        }
        }  else {
          setTimeout(() => {
            io.to(sessionId).emit('noMatch', gameSession.selectedEmojis);
            gameSession.selectedEmojis = [];
          }, 1000);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});
app.get('/scores/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const scores = gameSessions[sessionId] ? gameSessions[sessionId].scores : {};
  res.json(scores);
});

app.post('/register', async (req, res) => {
  const { phone_number, password } = req.body;
  if (!phone_number || !password) {
    return res.status(400).send('Both phone number and password are required.');
  }
  const existingUser = await User.findOne({ phone_number });
  if (existingUser) {
    return res.status(400).send('User already exists.');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ phone_number, password: hashedPassword });
  await user.save();
  res.status(201).json('User registered successfully.');
});

// Login route
app.post('/login', async (req, res) => {
  const { phone_number, password } = req.body;
  const user = await User.findOne({ phone_number });
  if (!user) {
    return res.status(401).json({ message: 'User not found.' });
  }
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Incorrect password.' });
  }
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.status(200).json({
    message: 'Login successful.',
    token: token,
    user: { phone_number: user.phone_number }
  });
});

// Registration route
app.post('/register', async (req, res) => {
  const { phone_number, password } = req.body;
  console.log('so far so good');
  if (!phone_number || !password) {
    return res.status(400).send('Both phone number and password are required.');
  }
  const existingUser = await User.findOne({ phone_number });
  if (existingUser) {
    return res.status(400).send('User already exists.');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ phone_number, password: hashedPassword });
  await user.save();
  res.status(201).json('User registered successfully.');
});

// Login route
app.post('/login', async (req, res) => {
  const { phone_number, password } = req.body;
  const user = await User.findOne({ phone_number });
  if (!user) {
    return res.status(401).json({ message: 'User not found.' });
  }
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Incorrect password.' });
  }
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.status(200).json({ message: 'Login successful.', token: token });
});



const port = process.env.PORT || 3002;
server.listen(port, () => console.log(`Server running on port ${port}`));
