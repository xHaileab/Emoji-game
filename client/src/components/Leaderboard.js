import React, { useState, useEffect, useRef } from 'react';
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
      <p>Player 1 Score: {scores.playerOne || 0}</p>
      <p>Player 2 Score: {scores.playerTwo || 0}</p>
    </div>
  );
};