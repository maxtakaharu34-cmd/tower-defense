import { useRef, useEffect, useState, useCallback } from 'react';

const W = 700, H = 500, CELL = 50;
const PATH: [number, number][] = [[0,2],[1,2],[2,2],[3,2],[3,3],[3,4],[3,5],[4,5],[5,5],[6,5],[6,4],[6,3],[7,3],[8,3],[9,3],[9,4],[9,5],[9,6],[9,7],[10,7],[11,7],[12,7],[13,7],[13,8],[13,9]];
const COLS = 14, ROWS = 10;

type TowerType = 'arrow' | 'cannon' | 'ice' | 'laser';
const TOWER_DEFS: Record<TowerType, { cost: number; dmg: number; range: number; rate: number; color: string; icon: string }> = {
  arrow:  { cost: 50,  dmg: 15,  range: 120, rate: 600,  color: '#4caf50', icon: '🏹' },
  cannon: { cost: 100, dmg: 40,  range: 100, rate: 1200, color: '#ff9800', icon: '💣' },
  ice:    { cost: 75,  dmg: 8,   range: 130, rate: 800,  color: '#03a9f4', icon: '❄️' },
  laser:  { cost: 150, dmg: 25,  range: 160, rate: 400,  color: '#e91e63', icon: '⚡' },
};

interface Tower { x: number; y: number; type: TowerType; lvl: number; lastFire: number; }
interface Enemy { x: number; y: number; hp: number; maxHp: number; speed: number; pathIdx: number; alive: boolean; slow: number; slowEnd: number; boss: boolean; reward: number; }
interface Proj { x: number; y: number; tx: number; ty: number; dmg: number; type: TowerType; speed: number; }

function spawnWave(wave: number): Enemy[] {
  const count = 5 + wave * 2;
  const hp = 30 + wave * 20;
  const spd = 0.8 + wave * 0.05;
  const enemies: Enemy[] = [];
  for (let i = 0; i < count; i++) {
    const isBoss = wave > 0 && wave % 5 === 0 && i === count - 1;
    enemies.push({
      x: PATH[0][0] * CELL + CELL / 2,
      y: PATH[0][1] * CELL + CELL / 2 - i * 40,
      hp: isBoss ? hp * 5 : hp,
      maxHp: isBoss ? hp * 5 : hp,
      speed: isBoss ? spd * 0.6 : spd,
      pathIdx: 0, alive: true, slow: 1, slowEnd: 0,
      boss: isBoss, reward: isBoss ? 100 : 10 + wave,
    });
  }
  return enemies;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }

export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<'menu' | 'play' | 'over' | 'win'>('menu');
  const [gold, setGold] = useState(200);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(1);
  const [selTower, setSelTower] = useState<TowerType>('arrow');

  const screenRef = useRef('menu');
  const towersRef = useRef<Tower[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const projsRef = useRef<Proj[]>([]);
  const goldRef = useRef(200);
  const livesRef = useRef(20);
  const waveRef = useRef(1);
  const waveActiveRef = useRef(false);
  const selRef = useRef<TowerType>('arrow');
  const animRef = useRef(0);
  const pathSet = new Set(PATH.map(([x, y]) => `${x},${y}`));

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { selRef.current = selTower; }, [selTower]);

  const startGame = useCallback(() => {
    towersRef.current = []; enemiesRef.current = []; projsRef.current = [];
    goldRef.current = 200; livesRef.current = 20; waveRef.current = 1;
    waveActiveRef.current = false;
    setGold(200); setLives(20); setWave(1); setScreen('play');
  }, []);

  const startWave = useCallback(() => {
    if (waveActiveRef.current) return;
    waveActiveRef.current = true;
    enemiesRef.current = spawnWave(waveRef.current);
  }, []);

  // Canvas click = place tower
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: MouseEvent) => {
      if (screenRef.current !== 'play') return;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
      const gx = Math.floor(mx / CELL), gy = Math.floor(my / CELL);
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
      if (pathSet.has(`${gx},${gy}`)) return;
      if (towersRef.current.some(t => t.x === gx && t.y === gy)) {
        // Upgrade existing tower
        const t = towersRef.current.find(t => t.x === gx && t.y === gy)!;
        const cost = TOWER_DEFS[t.type].cost * (t.lvl + 1);
        if (goldRef.current >= cost && t.lvl < 3) {
          goldRef.current -= cost; t.lvl++; setGold(goldRef.current);
        }
        return;
      }
      const def = TOWER_DEFS[selRef.current];
      if (goldRef.current < def.cost) return;
      goldRef.current -= def.cost; setGold(goldRef.current);
      towersRef.current.push({ x: gx, y: gy, type: selRef.current, lvl: 1, lastFire: 0 });
    };
    canvas.addEventListener('click', handler);
    return () => canvas.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const loop = (t: number) => {
      animRef.current = requestAnimationFrame(loop);
      ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, W, H);

      // Draw grid
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
        ctx.strokeStyle = '#222'; ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
      }

      // Path
      PATH.forEach(([px, py], i) => {
        ctx.fillStyle = i === PATH.length - 1 ? '#c62828' : '#2d2d44';
        ctx.fillRect(px * CELL, py * CELL, CELL, CELL);
      });
      ctx.fillStyle = '#4caf50'; ctx.fillRect(PATH[0][0] * CELL, PATH[0][1] * CELL, CELL, CELL);
      ctx.fillStyle = '#f44336'; ctx.fillRect(PATH[PATH.length - 1][0] * CELL, PATH[PATH.length - 1][1] * CELL, CELL, CELL);

      if (screenRef.current === 'menu') {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff9800'; ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 16;
        ctx.font = 'bold 40px monospace'; ctx.fillText('🏹 TOWER DEFENSE', W / 2, H / 2 - 40);
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#fff'; ctx.font = '18px monospace'; ctx.fillText('Click to place towers · Defend your base!', W / 2, H / 2 + 10);
        ctx.font = '14px monospace'; ctx.fillText('STARTで開始', W / 2, H / 2 + 50);
        ctx.shadowBlur = 0; ctx.textAlign = 'left'; return;
      }

      if (screenRef.current === 'over' || screenRef.current === 'win') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = screenRef.current === 'win' ? '#4caf50' : '#f44336';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18;
        ctx.font = 'bold 38px monospace'; ctx.fillText(screenRef.current === 'win' ? '🏆 VICTORY!' : '💀 ゲームオーバー', W / 2, H / 2 - 30);
        ctx.fillStyle = '#fff'; ctx.font = '18px monospace';
        ctx.fillText(`Wave ${waveRef.current} · Gold ${goldRef.current}`, W / 2, H / 2 + 10);
        ctx.shadowBlur = 0; ctx.textAlign = 'left'; return;
      }

      const now = t;
      const towers = towersRef.current;
      const enemies = enemiesRef.current;
      const projs = projsRef.current;

      // Update enemies
      enemies.forEach(e => {
        if (!e.alive) return;
        const nowMs = Date.now();
        const spd = e.speed * (nowMs < e.slowEnd ? e.slow : 1);
        const target = PATH[e.pathIdx];
        if (!target) return;
        const tx = target[0] * CELL + CELL / 2, ty = target[1] * CELL + CELL / 2;
        const dx = tx - e.x, dy = ty - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < spd * 2) {
          e.pathIdx++;
          if (e.pathIdx >= PATH.length) {
            e.alive = false;
            livesRef.current -= e.boss ? 5 : 1;
            setLives(livesRef.current);
            if (livesRef.current <= 0) setScreen('over');
          }
        } else {
          e.x += (dx / dist) * spd;
          e.y += (dy / dist) * spd;
        }
      });

      // Tower shooting
      towers.forEach(tw => {
        const def = TOWER_DEFS[tw.type];
        const rate = def.rate / tw.lvl;
        if (now - tw.lastFire < rate) return;
        const tcx = tw.x * CELL + CELL / 2, tcy = tw.y * CELL + CELL / 2;
        const range = def.range + tw.lvl * 15;
        const target = enemies.find(e => e.alive && Math.hypot(e.x - tcx, e.y - tcy) < range);
        if (!target) return;
        tw.lastFire = now;
        projs.push({ x: tcx, y: tcy, tx: target.x, ty: target.y, dmg: def.dmg * tw.lvl, type: tw.type, speed: 5 });
      });

      // Update projectiles
      for (let i = projs.length - 1; i >= 0; i--) {
        const p = projs[i];
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < p.speed * 2) {
          // Hit
          const hit = enemies.find(e => e.alive && Math.hypot(e.x - p.tx, e.y - p.ty) < 20);
          if (hit) {
            hit.hp -= p.dmg;
            if (p.type === 'ice') { hit.slow = 0.4; hit.slowEnd = Date.now() + 2000; }
            if (hit.hp <= 0) { hit.alive = false; goldRef.current += hit.reward; setGold(goldRef.current); }
          }
          projs.splice(i, 1);
        } else {
          p.x += (dx / dist) * p.speed;
          p.y += (dy / dist) * p.speed;
        }
      }

      // Wave completion
      if (waveActiveRef.current && enemies.every(e => !e.alive)) {
        waveActiveRef.current = false;
        if (waveRef.current >= 20) { setScreen('win'); return; }
        waveRef.current++; setWave(waveRef.current);
        goldRef.current += 30 + waveRef.current * 5; setGold(goldRef.current);
      }

      // Draw towers
      towers.forEach(tw => {
        const def = TOWER_DEFS[tw.type];
        ctx.fillStyle = def.color + '44';
        ctx.fillRect(tw.x * CELL + 2, tw.y * CELL + 2, CELL - 4, CELL - 4);
        ctx.strokeStyle = def.color; ctx.lineWidth = 2;
        ctx.strokeRect(tw.x * CELL + 2, tw.y * CELL + 2, CELL - 4, CELL - 4);
        ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, tw.x * CELL + CELL / 2, tw.y * CELL + CELL / 2);
        if (tw.lvl > 1) {
          ctx.fillStyle = '#ff0'; ctx.font = 'bold 10px monospace';
          ctx.fillText(`Lv${tw.lvl}`, tw.x * CELL + CELL / 2, tw.y * CELL + CELL - 4);
        }
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      });

      // Draw enemies
      enemies.forEach(e => {
        if (!e.alive) return;
        const sz = e.boss ? 18 : 10;
        ctx.fillStyle = e.boss ? '#ff1744' : '#e040fb';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(e.x, e.y, sz, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // HP bar
        const bw = e.boss ? 36 : 20;
        ctx.fillStyle = '#333'; ctx.fillRect(e.x - bw / 2, e.y - sz - 6, bw, 4);
        ctx.fillStyle = e.hp > e.maxHp * 0.5 ? '#4caf50' : e.hp > e.maxHp * 0.25 ? '#ff9800' : '#f44336';
        ctx.fillRect(e.x - bw / 2, e.y - sz - 6, bw * (e.hp / e.maxHp), 4);
        if (Date.now() < e.slowEnd) {
          ctx.fillStyle = '#03a9f4'; ctx.font = '8px Arial'; ctx.textAlign = 'center';
          ctx.fillText('❄', e.x, e.y - sz - 10); ctx.textAlign = 'left';
        }
      });

      // Draw projectiles
      projs.forEach(p => {
        const col = TOWER_DEFS[p.type].color;
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      });

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, 0, 0, W, 28, 0); ctx.fill();
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 14px monospace';
      ctx.fillText(`💰 ${goldRef.current}`, 10, 20);
      ctx.fillStyle = '#f44336'; ctx.fillText(`❤️ ${livesRef.current}`, 120, 20);
      ctx.fillStyle = '#fff'; ctx.fillText(`Wave ${waveRef.current}/20`, 230, 20);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1e] to-[#1a1a2e] flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl md:text-4xl font-black mb-3 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">🏹 タワーディフェンス</h1>
      <canvas ref={canvasRef} className="rounded-xl border-2 border-orange-800" style={{ maxWidth: '100%' }} />
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {screen === 'menu' && <button onClick={startGame} className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-bold hover:scale-105">スタート</button>}
        {screen === 'play' && (
          <>
            {(Object.keys(TOWER_DEFS) as TowerType[]).map(t => {
              const d = TOWER_DEFS[t];
              return <button key={t} onClick={() => setSelTower(t)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border-2 transition-all ${selTower === t ? 'border-yellow-400 scale-105' : 'border-gray-600'}`}
                style={{ background: d.color + '22', color: d.color }}>
                {d.icon} {d.cost}g
              </button>;
            })}
            <button onClick={startWave} className="px-4 py-1 bg-red-700 text-white rounded-lg text-xs font-bold hover:bg-red-600">▶ Send Wave</button>
          </>
        )}
        {(screen === 'over' || screen === 'win') && <button onClick={startGame} className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-bold hover:scale-105">リスタート</button>}
      </div>
      <p className="text-gray-500 text-xs mt-2">Click grid to place towers · Click tower to upgrade · Enemies follow the path</p>
    </div>
  );
}
