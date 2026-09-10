import './ui/style.css';
import { Game } from './game/Game';
const game = new Game(document.querySelector<HTMLCanvasElement>('#game')!);
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
if(import.meta.hot)import.meta.hot.dispose(()=>game.dispose());
if(import.meta.env.DEV && new URLSearchParams(location.search).has('mapcheck'))import('./dev/MapValidation').then(m=>m.mapValidation(game));

if(import.meta.env.DEV && new URLSearchParams(location.search).has('perf'))import('./dev/PerformanceMonitor').then(({PerformanceMonitor})=>{const monitor=new PerformanceMonitor(game);if(import.meta.hot)import.meta.hot.dispose(()=>monitor.dispose());});
