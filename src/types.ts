export type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

export interface Entity {
  id: string;
  lane: number; // -1, 0, 1
  z: number;    // Distance from start
  type: 'OBSTACLE' | 'COIN';
}

export interface Player {
  lane: number;
  targetLane: number;
  y: number;
  jumpVelocity: number;
  isJumping: boolean;
}
