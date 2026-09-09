import './ui/style.css';
import { Game } from './game/Game';
const game = new Game(document.querySelector<HTMLCanvasElement>('#game')!);
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
if(import.meta.hot)import.meta.hot.dispose(()=>game.dispose());
