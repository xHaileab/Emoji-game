const io = require('socket.io-client');
const socket = io('http://localhost:3002');

socket.on('connect', () => {
    console.log('Connected to the server via WebSocket');

    // Simulate a player joining the game
    socket.emit('joinGame', 'someGameSessionId');
});

socket.on('startGame', (data) => {
    console.log('Game is starting!', data);
    // Perform actions to start the game
});

socket.on('waitingForPlayers', (data) => {
    console.log('Waiting for more players', data);
});



/*


*/