import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Play, RotateCcw, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameState, Entity, Player } from '../types';

const LANES = 3;
const LANE_WIDTH = 1.0;
const FOCAL_LENGTH = 400;
const INITIAL_SPEED = 0.2;
const SPEED_INCREMENT = 0.00005;
const MAX_SPEED = 0.8;
const JUMP_FORCE = 0.15;
const GRAVITY = 0.008;
const SPAWN_DISTANCE = 50;
const DESPAWN_DISTANCE = -5;

export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('cyber-dash-highscore');
    return saved ? parseInt(saved) : 0;
  });

  // Game state refs for the loop
  const gameRef = useRef({
    player: {
      lane: 0,
      targetLane: 0,
      y: 0,
      jumpVelocity: 0,
      isJumping: false,
    } as Player,
    entities: [] as Entity[],
    particles: [] as { x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, color: string }[],
    speed: INITIAL_SPEED,
    distance: 0,
    lastSpawnZ: 0,
    score: 0,
    coins: 0,
    animationFrame: 0,
    touchStart: { x: 0, y: 0 },
  });

  const startGame = () => {
    gameRef.current = {
      player: {
        lane: 0,
        targetLane: 0,
        y: 0,
        jumpVelocity: 0,
        isJumping: false,
      },
      entities: [],
      particles: [],
      speed: INITIAL_SPEED,
      distance: 0,
      lastSpawnZ: 0,
      score: 0,
      coins: 0,
      animationFrame: 0,
      touchStart: { x: 0, y: 0 },
    };
    setScore(0);
    setCoins(0);
    setGameState('PLAYING');
  };

  const spawnParticles = (x: number, y: number, z: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      gameRef.current.particles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        vz: (Math.random() - 0.5) * 0.2,
        life: 1.0,
        color
      });
    }
  };

  const gameOver = () => {
    setGameState('GAMEOVER');
    if (gameRef.current.score > highScore) {
      setHighScore(gameRef.current.score);
      localStorage.setItem('cyber-dash-highscore', gameRef.current.score.toString());
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#00f2ff', '#ff0055', '#ffd700']
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    gameRef.current.touchStart = { x: clientX, y: clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
    
    const dx = clientX - gameRef.current.touchStart.x;
    const dy = clientY - gameRef.current.touchStart.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) {
        // Horizontal swipe
        if (dx > 0) {
          // Right
          gameRef.current.player.targetLane = Math.min(1, gameRef.current.player.targetLane + 1);
        } else {
          // Left
          gameRef.current.player.targetLane = Math.max(-1, gameRef.current.player.targetLane - 1);
        }
      }
    } else {
      if (dy < -30) {
        // Up swipe or tap to jump
        if (!gameRef.current.player.isJumping) {
          gameRef.current.player.isJumping = true;
          gameRef.current.player.jumpVelocity = JUMP_FORCE;
        }
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        // Tap to jump
        if (!gameRef.current.player.isJumping) {
          gameRef.current.player.isJumping = true;
          gameRef.current.player.jumpVelocity = JUMP_FORCE;
        }
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const update = () => {
      if (gameState !== 'PLAYING') return;

      const state = gameRef.current;
      
      // Update speed
      state.speed = Math.min(MAX_SPEED, state.speed + SPEED_INCREMENT);
      state.distance += state.speed;
      state.score = Math.floor(state.distance);

      // Update player lane transition
      const laneDiff = state.player.targetLane - state.player.lane;
      state.player.lane += laneDiff * 0.2;

      // Update player jump
      if (state.player.isJumping) {
        state.player.y += state.player.jumpVelocity;
        state.player.jumpVelocity -= GRAVITY;
        if (state.player.y <= 0) {
          state.player.y = 0;
          state.player.isJumping = false;
          state.player.jumpVelocity = 0;
        }
      }

      // Spawn entities
      if (state.distance - state.lastSpawnZ > 10) {
        state.lastSpawnZ = state.distance;
        const lane = Math.floor(Math.random() * 3) - 1;
        const type = Math.random() > 0.3 ? 'COIN' : 'OBSTACLE';
        state.entities.push({
          id: Math.random().toString(36).substr(2, 9),
          lane,
          z: state.distance + SPAWN_DISTANCE,
          type
        });
      }

      // Update entities and collisions
      state.entities = state.entities.filter(entity => {
        const relativeZ = entity.z - (state.distance + 2);
        
        // Collision check
        if (relativeZ < 0.5 && relativeZ > -0.5) {
          const laneDist = Math.abs(entity.lane - state.player.lane);
          if (laneDist < 0.5) {
            if (entity.type === 'COIN') {
              state.coins += 1;
              spawnParticles(entity.lane * LANE_WIDTH, 0.5, entity.z, '#ffd700', 10);
              return false; // Remove coin
            } else if (entity.type === 'OBSTACLE') {
              if (state.player.y < 0.5) {
                spawnParticles(state.player.lane * LANE_WIDTH, state.player.y, state.distance + 2, '#ff0055', 30);
                gameOver();
              }
            }
          }
        }

        return relativeZ > DESPAWN_DISTANCE;
      });

      // Update particles
      state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.life -= 0.02;
        return p.life > 0;
      });

      // Sync state to UI occasionally (every 10 frames)
      if (state.animationFrame % 10 === 0) {
        setScore(state.score);
        setCoins(state.coins);
      }
    };

    const draw = () => {
      const state = gameRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.7;

      // Draw Background / Sky (Jungle/Ancient theme)
      const gradient = ctx.createRadialGradient(centerX, centerY * 0.6, 0, centerX, centerY * 0.6, canvas.height);
      gradient.addColorStop(0, '#152515');
      gradient.addColorStop(1, '#050805');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Speed Lines (Subtle wind/leaves)
      if (gameState === 'PLAYING') {
        ctx.strokeStyle = '#28ff64';
        ctx.lineWidth = 1;
        const lineCount = Math.floor(state.speed * 30);
        for (let i = 0; i < lineCount; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const len = Math.random() * 30 * state.speed;
          ctx.globalAlpha = Math.random() * 0.1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Draw Grid/Road (Ancient Path)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2;
      
      // Path Surface
      const pathGradient = ctx.createLinearGradient(0, centerY, 0, canvas.height);
      pathGradient.addColorStop(0, '#0a0a0a');
      pathGradient.addColorStop(0.4, '#1A130F');
      pathGradient.addColorStop(1, '#2D1F18');
      
      // Draw path shape
      ctx.fillStyle = pathGradient;
      ctx.beginPath();
      const xL = (-1.5 * LANE_WIDTH / 1) * FOCAL_LENGTH + centerX;
      const xR = (1.5 * LANE_WIDTH / 1) * FOCAL_LENGTH + centerX;
      const xTL = (-1.5 * LANE_WIDTH / 100) * FOCAL_LENGTH + centerX;
      const xTR = (1.5 * LANE_WIDTH / 100) * FOCAL_LENGTH + centerX;
      const yB = centerY;
      const yT = (0 / 100) * FOCAL_LENGTH + centerY;
      
      ctx.moveTo(xL, yB);
      ctx.lineTo(xTL, yT);
      ctx.lineTo(xTR, yT);
      ctx.lineTo(xR, yB);
      ctx.closePath();
      ctx.fill();

      // Longitudinal lines (lanes)
      for (let i = -1.5; i <= 1.5; i++) {
        const xStart = i * LANE_WIDTH;
        const zStart = 1;
        const zEnd = 100;

        const x1 = (xStart / zStart) * FOCAL_LENGTH + centerX;
        const y1 = (0 / zStart) * FOCAL_LENGTH + centerY;
        const x2 = (xStart / zEnd) * FOCAL_LENGTH + centerX;
        const y2 = (0 / zEnd) * FOCAL_LENGTH + centerY;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Transversal lines (moving grid)
      const gridSpacing = 5;
      const offset = state.distance % gridSpacing;
      for (let z = gridSpacing - offset; z < 100; z += gridSpacing) {
        const zVal = z;
        const x1 = (-1.5 * LANE_WIDTH / zVal) * FOCAL_LENGTH + centerX;
        const x2 = (1.5 * LANE_WIDTH / zVal) * FOCAL_LENGTH + centerX;
        const y = (0 / zVal) * FOCAL_LENGTH + centerY;

        ctx.globalAlpha = Math.max(0, 1 - z / 50);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Draw Entities
      state.entities.forEach(entity => {
        const relativeZ = entity.z - state.distance;
        if (relativeZ <= 0) return;

        const x = (entity.lane * LANE_WIDTH / relativeZ) * FOCAL_LENGTH + centerX;
        const y = (0 / relativeZ) * FOCAL_LENGTH + centerY;
        const size = (1 / relativeZ) * FOCAL_LENGTH;

        ctx.globalAlpha = Math.min(1, 2 - relativeZ / 20);
        
        if (entity.type === 'COIN') {
          ctx.fillStyle = '#FFC400';
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(255, 196, 0, 0.5)';
          ctx.beginPath();
          ctx.arc(x, y - size * 0.5, size * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#333';
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 1;
          ctx.fillRect(x - size * 0.4, y - size * 0.8, size * 0.8, size * 0.8);
          ctx.strokeRect(x - size * 0.4, y - size * 0.8, size * 0.8, size * 0.8);
        }
        ctx.globalAlpha = 1;
      });

      // Draw Particles
      state.particles.forEach(p => {
        const relativeZ = p.z - state.distance;
        if (relativeZ <= 0) return;

        const x = (p.x / relativeZ) * FOCAL_LENGTH + centerX;
        const y = (-p.y / relativeZ) * FOCAL_LENGTH + centerY;
        const size = (0.2 / relativeZ) * FOCAL_LENGTH;

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      });
      ctx.globalAlpha = 1;

      // Draw Player
      const pX = (state.player.lane * LANE_WIDTH / 2) * FOCAL_LENGTH + centerX;
      const pY = (-state.player.y / 2) * FOCAL_LENGTH + centerY;
      const pSize = (1 / 2) * FOCAL_LENGTH;

      // Player Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(0, 255, 100, 0.4)';
      ctx.fillStyle = '#111';
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.roundRect(pX - pSize * 0.3, pY - pSize * 1.1, pSize * 0.6, pSize * 1.1, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      state.animationFrame = requestAnimationFrame(loop);
    };

    const loop = () => {
      update();
      draw();
    };

    const frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [gameState]);

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-[#050805] touch-none select-none"
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Vignette Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,rgba(0,0,0,0.8)_100%)] pointer-events-none z-10" />

      {/* HUD */}
      <div className="absolute top-10 left-10 right-10 flex justify-between items-start pointer-events-none z-20">
        <div className="glass-panel px-6 py-4 rounded-2xl min-w-[180px]">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1 block font-sans">Distance</span>
          <div className="text-3xl font-extrabold tabular-nums text-white font-sans">
            {score.toLocaleString()}m
          </div>
        </div>

        <div className="glass-panel px-6 py-4 rounded-2xl min-w-[180px]">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1 block font-sans">Treasures</span>
          <div className="text-3xl font-extrabold tabular-nums text-[#FFC400] drop-shadow-[0_0_15px_rgba(255,196,0,0.5)] font-sans">
            {coins}
          </div>
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[#050805]/90 backdrop-blur-sm z-50"
          >
            <motion.h1 
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-6xl md:text-8xl font-black text-[#FFC400] mb-4 italic uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(255,196,0,0.3)]"
            >
              Ancient Dash
            </motion.h1>
            <p className="text-white/40 font-sans mb-12 uppercase tracking-[0.3em] text-xs">
              Swipe Left/Right to Shift • Tap to Jump
            </p>
            <button 
              onClick={startGame}
              className="group relative px-12 py-4 bg-[#FFC400] text-black font-bold text-xl uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 rounded-full"
            >
              <div className="absolute inset-0 bg-[#FFC400] blur-xl opacity-30 group-hover:opacity-60 transition-opacity rounded-full" />
              <span className="relative flex items-center gap-2">
                <Play className="w-6 h-6 fill-current" />
                Begin Quest
              </span>
            </button>
            <div className="mt-12 flex items-center gap-4 text-white/30 font-sans text-xs uppercase tracking-widest">
              <Trophy className="w-4 h-4" />
              <span>Best Distance: {highScore.toLocaleString()}m</span>
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[#050805]/95 backdrop-blur-md z-50"
          >
            <motion.h2 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-6xl md:text-8xl font-black text-white mb-8 italic uppercase tracking-tighter"
            >
              Quest Ended
            </motion.h2>
            
            <div className="grid grid-cols-2 gap-8 mb-12 w-full max-w-md px-8">
              <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
                <span className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Distance</span>
                <span className="text-3xl font-extrabold text-white">{score}m</span>
              </div>
              <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
                <span className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Treasures</span>
                <span className="text-3xl font-extrabold text-[#FFC400]">{coins}</span>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="group relative px-12 py-4 bg-white text-black font-bold text-xl uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 rounded-full"
            >
              <div className="absolute inset-0 bg-white blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
              <span className="relative flex items-center gap-2">
                <RotateCcw className="w-6 h-6" />
                Retry Quest
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Hint */}
      <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none z-20">
        <span className="text-[11px] font-light uppercase tracking-[0.4em] text-white/30">
          Swipe Left/Right to Shift &bull; Tap to Jump
        </span>
      </div>

      {/* Speed Indicator */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-20">
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-[#FFC400] shadow-[0_0_10px_#FFC400]"
            animate={{ width: `${(gameRef.current.speed / MAX_SPEED) * 100}%` }}
          />
        </div>
        <span className="text-[9px] text-white/20 font-sans uppercase tracking-[0.3em]">Momentum</span>
      </div>
    </div>
  );
};
