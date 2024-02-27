import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Leaderboard from './Leaderboard.js';
import './App.css';
import { useAuth } from './AuthContext';


const GamePage = () => {
  // const [userPhoneNumber, setUserPhoneNumber] = useState(''); 
  const [emojis, setEmojis] = useState([]);
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [socket, setSocket] = useState(null);
  const [showStartButton, setShowStartButton] = useState(true)
  const [countdown, setCountdown] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [playerScores, setPlayerScores] = useState({ playerOne: 0, playerTwo: 0 });
  const { auth, setAuth } = useAuth();
  const [timeLeft, setTimeLeft] = useState(60);
  const initialTimeLeft = 60;
  const timerInterval = useRef(null); 



  useEffect(() => {
    const newSocket = io('http://localhost:3002');
    setSocket(newSocket);

    newSocket.on('gameStarted', (gameState) => {
      console.log('Game started:', gameState);
      setStarted(true);
      setEmojis(gameState.emojis);
      setWaitingForPlayer(false);
    });

    newSocket.on('matchFound', ({ score, emojis }) => {
      initializeGame();
      setScore(score);
      setEmojis(emojis);
    });

    newSocket.on('noMatch', () => {
    });

    newSocket.on('gameUpdate', (gameState) => {
      console.log('Received game state:', gameState);
      setStarted(true);
      setEmojis(gameState.emojis);
      setTimeLeft(gameState.timeLeft);
      setScore(gameState.score);
      setShowStartButton(false);
      setWaitingForPlayer(false);
      setSelectedEmojis([]);
      setSessionId(gameState.sessionId);
    });

    newSocket.on('clearSelectedEmojis', () => {
      setSelectedEmojis([]);
    });

    newSocket.on('waitingForPlayer', () => {
      setWaitingForPlayer(true);
      setShowStartButton(false);
    });

    newSocket.on('countdown', (count) => {
      setCountdown(count);
      if (count === 0) {
      }
    });
    newSocket.on('gameStateUpdated', (gameState) => {
      setScore(gameState.score);
      setEmojis(gameState.emojis);
      setSelectedEmojis([]);
    });

    newSocket.on('scoreUpdate', (scores) => {
      setPlayerScores(scores); // Assuming scores is an object like { playerOne: X, playerTwo: Y }
      
    });

    newSocket.on('timeUpdate', ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    })

    newSocket.on('endGame', (gameState) => {
  console.log('End Game received', gameState); // Add this for debugging
  endGame();
  setPlayerScores(gameState.scores); // Make sure `gameState.scores` is the expected format
});
    return () => newSocket.disconnect();
  }, []);

  // useEffect(() => {
  //   if (timeLeft === 0) {
  //     endGame();
  //   }
  // }, [timeLeft]);

  const startGame = () => {
    if (socket) {
      socket.emit('startGame');
      setTimeLeft(initialTimeLeft);
      setShowStartButton(false);
      setWaitingForPlayer(true);
      setScore(0);
    }
  };

  useEffect(() => {
    if (socket) {
      socket.on('scoreUpdate', (scores) => {
        setPlayerScores(scores); // This should update the state with new scores
      });
    }
  
    // Clean up the event listener when the component unmounts or re-renders
    return () => {
      if (socket) {
        socket.off('scoreUpdate');
      }
    };
  }, [socket]); // Dependency array ensures this effect runs when `socket` changes
  

  useEffect(() => {
    if (started) {
      timerInterval.current = setInterval(() => {
        setTimeLeft(prevTime => prevTime > 0 ? prevTime - 1 : 0);
      }, 1000);

      return () => clearInterval(timerInterval.current);
    }
  }, [started]);

  // useEffect(() => {
  //   if (timeLeft === 0) {
  //     endGame();
  //     setShowStartButton(true);
  //   }
  // }, [timeLeft]);

  const initializeGame = () => {
    const emojiSet = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍"];
    let randomEmojis = [...emojiSet];
    const duplicatedEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
    randomEmojis.push(duplicatedEmoji);
    randomEmojis.sort(() => Math.random() - 0.5);
    randomEmojis = randomEmojis.slice(0, 16);

    setEmojis(randomEmojis);
    setSelectedEmojis([]);
  };


  const handleEmojiClick = (index) => {
    if (!started || selectedEmojis.includes(index)) {
      return;
    }
  
    const newSelectedEmojis = selectedEmojis.length < 2 ? [...selectedEmojis, index] : [index];
    setSelectedEmojis(newSelectedEmojis);
  
    if (newSelectedEmojis.length === 2) {
      const [firstEmojiIndex, secondEmojiIndex] = newSelectedEmojis;
      if (emojis[firstEmojiIndex] === emojis[secondEmojiIndex]) {
        setScore((prevScore) => prevScore + 1);
        socket.emit('matchFound', {
          sessionId,
          emojis: initializeGame()
        });
      } else {
        socket.emit('noMatch', {
          indices: [firstEmojiIndex, secondEmojiIndex],
          sessionId
        });
      }
      setTimeout(() => {
        setSelectedEmojis([]);
      }, 1000);
    }
  };

  const endGame = () => {
    setStarted(false);
    //setScore(0);
    setTimeLeft(60);
    setEmojis([]);
    setWaitingForPlayer(false);
    setShowStartButton(true);
  };

  const handleLogout = () => {
    setAuth(null); // Clear auth context
    // Redirect to login page or use navigate from react-router
  };
  const Leaderboard = ({ sessionId }) => {
    const [scores, setScores] = useState({});
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      const fetchData = async () => {
        try {
          const response = await fetch(`/scores/${sessionId}`);
          const data = await response.json();
          setScores(data);
        } catch (error) {
          console.error('Error fetching scores:', error);
        } finally {
          setLoading(false);
        }
      };
  
      fetchData();
    }, [sessionId]);
  
    if (loading) {
      return <div>Loading...</div>;
    }
  
    return (
      <div className="scores">
        <h2>Leaderboard</h2>
        <p>Player 1 Score: {score.playerOne || 0}</p>
        <p>Player 2 Score: {score.playerTwo || 0}</p>
      </div>
    );
  };
  return (
    <div className="App">
      <header className="App-header">
        <h1>Emoji Matching Game</h1>
        <div>Score: {score}</div>
        <div>
        <h2>Leaderboard</h2>
      <p>Player 1 Score: {score.playerOne || 0}</p>
      <p>Player 2 Score: {score.playerTwo || 0}</p>
    </div>
        <div className="scores">
</div>
        {/* <div>userPhoneNumber: {setUserPhoneNumber}</div> */}
        <div>Time Left: {timeLeft}</div>
        
        {waitingForPlayer && <p>Waiting for another player...</p>}
        {countdown !== null && <p>Starting in: {countdown}</p>}
        {showStartButton && !waitingForPlayer && (
          <button onClick={startGame}>Start Game</button>
        )}
        <div className="emoji-grid">
          {emojis.length > 0 && emojis.map((emoji, index) => (
            <button
              key={index}
              className={`emoji ${selectedEmojis.includes(index) ? 'selected' : ''}`}
              onClick={() => handleEmojiClick(index)}
              disabled={!started}
            >
              {emoji}
            </button>
          ))}
        </div>
      </header>
      {sessionId && <Leaderboard sessionId={sessionId} />}
    </div>
  );
};

export default GamePage;
