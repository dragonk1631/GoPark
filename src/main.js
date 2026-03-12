import './style.css'
import { aiEngine } from './AiEngine.js'

const COL_NAMES = "ABCDEFGHJKLMNOPQRST";

class GoGame {
  constructor(canvasId, size = 19) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.size = size;
    this.board = Array(size).fill(null).map(() => Array(size).fill(0));
    this.turn = 1;
    this.padding = 45;
    this.cellSize = (this.canvas.width - this.padding * 2) / (size - 1);
    this.isAiThinking = false;
    this.lastMove = null;
    this.analysis = { move: '', winRate: '50.0', reason: '대국을 시작해주세요.' };
    
    // Animation state
    this.animations = []; // [{x, y, color, startTime, type}]
    this.pulseAlpha = 0;
    this.pulseDir = 1;

    // Audio Context
    this.audioCtx = null;

    this.init();
    this.animate(); // Start animation loop
  }

  async init() {
    this.render();
    this.canvas.addEventListener('mousedown', (e) => this.handleCanvasClick(e));
    document.getElementById('reset-btn').addEventListener('click', () => this.reset());
    document.getElementById('score-btn').addEventListener('click', () => this.calculateScore());
    document.getElementById('level-select').addEventListener('change', (e) => this.changeLevel(e.target.value));

    try {
      this.setTutorMessage("AI 엔진(Worker) 활성화 중...");
      this.updateStatus('AI Engine (WASM) Status', '[cite: Initializing...]', 'secondary');
      
      await aiEngine.init();
      await aiEngine.setBoardSize(this.size).catch(() => {});
      await aiEngine.setLevel(document.getElementById('level-select').value).catch(() => {});
      
      this.updateStatus('AI Engine (WASM) Status', '[cite: Running]', 'running');
      this.setTutorMessage("안녕하세요! 저는 AI Tutor 고요정입니다. <br>대국을 시작하시겠어요?");
    } catch (error) {
      console.error('AI Initialization failed:', error);
      this.updateStatus('AI Engine (WASM) Status', '[cite: Error]', 'error');
    }
  }

  // Synthesize a stone placement sound using Web Audio API
  playStoneSound() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  updateStatus(label, value, type = '') {
      const idMap = { 'Status': 'ai-status', 'Command': 'last-command', 'Analysis': 'analysis-text' };
      for (let key in idMap) {
          if (label.includes(key)) {
              const el = document.getElementById(idMap[key]);
              if (el) {
                  el.innerText = value;
                  if (key === 'Status') el.className = 'value ' + (type === 'running' ? 'status-running' : '');
              }
          }
      }
      if (label.includes('Analysis')) {
          const pctEl = document.getElementById('analysis-percentage');
          if (pctEl) pctEl.innerText = `(cite: ${this.analysis.winRate}%)`;
      }
  }

  toGtp(x, y) {
    return `${COL_NAMES[x]}${this.size - y}`;
  }

  fromGtp(gtp) {
    if (!gtp || gtp.toUpperCase() === 'PASS') return null;
    const x = COL_NAMES.indexOf(gtp[0].toUpperCase());
    const y = this.size - parseInt(gtp.substring(1));
    return x !== -1 ? { x, y } : null;
  }

  animate() {
    // Pulse effect update
    this.pulseAlpha += 0.02 * this.pulseDir;
    if (this.pulseAlpha > 0.5 || this.pulseAlpha < 0) this.pulseDir *= -1;

    // Filter out finished animations
    const now = Date.now();
    this.animations = this.animations.filter(a => now - a.startTime < 300);

    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    this.drawBoard();
    this.drawStones();
    if (this.lastMove) this.drawLastMoveEffect();
    this.drawAnimations();
  }

  drawBoard() {
    const { ctx, padding, cellSize, size } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Board Body
    ctx.save();
    ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#e3a857';
    ctx.fillRect(padding - 20, padding - 20, (size-1)*cellSize + 40, (size-1)*cellSize + 40);
    ctx.restore();

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < size; i++) {
        ctx.moveTo(padding, padding + i * cellSize); ctx.lineTo(padding + (size-1)*cellSize, padding + i * cellSize);
        ctx.moveTo(padding + i * cellSize, padding); ctx.lineTo(padding + i * cellSize, padding + (size-1)*cellSize);
    }
    ctx.stroke();

    // Hoshi
    if (size === 19) {
      ctx.fillStyle = '#000';
      [3, 9, 15].forEach(x => [3, 9, 15].forEach(y => {
          ctx.beginPath(); ctx.arc(padding + x * cellSize, padding + y * cellSize, 4, 0, Math.PI * 2); ctx.fill();
      }));
    }

    // Coordinates
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = 'bold 12px Outfit'; ctx.textAlign = 'center';
    for (let i = 0; i < size; i++) {
        ctx.fillText(COL_NAMES[i], padding + i * cellSize, padding - 25);
        ctx.fillText(size - i, padding - 25, padding + i * cellSize + 5);
    }
  }

  drawStones() {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const stone = this.board[y][x];
        if (stone !== 0) {
            // Check if this stone is currently animating (we don't draw it static yet)
            const isAnimating = this.animations.some(a => a.x === x && a.y === y);
            if (!isAnimating) this.drawSingleStone(x, y, stone);
        }
      }
    }
  }

  drawSingleStone(x, y, color, scale = 1, alpha = 1) {
    const { ctx, padding, cellSize } = this;
    const centerX = padding + x * cellSize;
    const centerY = padding + y * cellSize;
    const radius = cellSize * 0.46 * scale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowOffsetY = 2;

    const grad = ctx.createRadialGradient(centerX - radius*0.3, centerY - radius*0.3, radius*0.1, centerX, centerY, radius);
    if (color === 1) { grad.addColorStop(0, '#444'); grad.addColorStop(1, '#000'); }
    else { grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#ddd'); }

    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
    if (color === 2) { ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.stroke(); }
    ctx.restore();
  }

  drawLastMoveEffect() {
    const { ctx, padding, cellSize, lastMove, pulseAlpha } = this;
    const centerX = padding + lastMove.x * cellSize;
    const centerY = padding + lastMove.y * cellSize;

    // Pulsing circle
    ctx.save();
    ctx.strokeStyle = this.board[lastMove.y][lastMove.x] === 1 ? `rgba(255,255,255,${0.5 + pulseAlpha})` : `rgba(0,0,0,${0.5 + pulseAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, cellSize * 0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawAnimations() {
    const now = Date.now();
    this.animations.forEach(a => {
        const progress = (now - a.startTime) / 300;
        const scale = 1.5 - (0.5 * Math.sin(progress * Math.PI / 2)); // Dynamic drop scale
        const alpha = Math.min(1, progress * 2);
        this.drawSingleStone(a.x, a.y, a.color, scale, alpha);
    });
  }

  async handleCanvasClick(e) {
    if (this.turn !== 1 || this.isAiThinking) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) * (this.canvas.width / rect.width) - this.padding) / this.cellSize);
    const y = Math.round(((e.clientY - rect.top) * (this.canvas.height / rect.height) - this.padding) / this.cellSize);
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) await this.playerMove(x, y);
  }

  async playerMove(x, y) {
    if (this.board[y][x] !== 0) return;
    const coord = this.toGtp(x, y);
    try {
      this.isAiThinking = true;
      this.updateStatus('Last GTP Command', `play black ${coord.toLowerCase()}`);
      
      const res = await aiEngine.playMove('black', coord);
      if (res.startsWith('?')) {
        this.setTutorMessage("그 자리는 착수가 금지된 곳입니다.");
        this.isAiThinking = false; return;
      }

      this.playStoneSound();
      this.animations.push({ x, y, color: 1, startTime: Date.now() });
      this.board[y][x] = 1;
      this.lastMove = { x, y };
      this.turn = 2;
      this.updateUI();
      setTimeout(() => this.aiMove(), 600);
    } catch (e) { this.isAiThinking = false; }
  }

  async aiMove() {
    this.isAiThinking = true;
    this.setTutorMessage("음... 어디가 좋을까요? 생각 중입니다...");
    try {
      const gtpMove = await aiEngine.getMove('white');
      this.updateStatus('Last GTP Command', `genmove white -> ${gtpMove}`);
      if (gtpMove === 'PASS') {
        this.setTutorMessage("제가 이번 차례는 패스하겠습니다.");
      } else {
        await this.syncBoard();
        const pos = this.fromGtp(gtpMove);
        if (pos) {
            this.playStoneSound();
            this.animations.push({ x: pos.x, y: pos.y, color: 2, startTime: Date.now() });
            this.lastMove = pos;
        }
        this.updateTutorAfterMove(gtpMove, false);
      }
      this.turn = 1; this.isAiThinking = false; this.updateUI(); this.requestTutorHint();
    } catch (e) { this.isAiThinking = false; }
  }

  async requestTutorHint() {
    if (this.turn !== 1) return;
    try {
        const hint = await aiEngine.getTutorHint('black');
        if (hint && hint.move !== 'PASS') {
            this.analysis = { move: hint.move, winRate: hint.winRate, reason: hint.reason };
            this.setTutorMessage(`${hint.move} 자리가 급소 같네요!<br>그곳에 두면 유리해질 거예요.`);
            this.updateStatus('Analysis', hint.reason);
        }
    } catch (e) {}
  }

  async syncBoard() {
    const blackStones = await aiEngine.listStones('black');
    const whiteStones = await aiEngine.listStones('white');
    if (blackStones === null && whiteStones === null) return;
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) this.board[y][x] = 0;
    if (blackStones) blackStones.forEach(c => { const p = this.fromGtp(c); if(p) this.board[p.y][p.x] = 1; });
    if (whiteStones) whiteStones.forEach(c => { const p = this.fromGtp(c); if(p) this.board[p.y][p.x] = 2; });
  }

  updateTutorAfterMove(coord, isPlayer) {
    const msgs = isPlayer ? [`멋진 선택입니다!`] : [`저는 ${coord}에 두어 보겠습니다.`];
    this.setTutorMessage(msgs[0]);
  }

  setTutorMessage(msg) {
    const el = document.getElementById('tutor-message');
    if (el) el.innerHTML = msg;
  }

  updateUI() {
    const turnEl = document.getElementById('current-turn');
    if (turnEl) turnEl.innerText = this.turn === 1 ? '흑번 (나)' : '백번 (상대)';
  }

  async changeLevel(level) {
      try {
          await aiEngine.setLevel(level);
          this.setTutorMessage(`AI 난이도를 ${level}단계로 설정했습니다.`);
      } catch (e) {
          console.warn('Level change failed:', e);
      }
  }

  async calculateScore() {
      if (this.isAiThinking) return;
      this.isAiThinking = true;
      this.setTutorMessage("판 위의 돌들을 분석하여 집 차이를 계산 중입니다...");
      try {
          const scoreStr = await aiEngine.getScore();
          this.setTutorMessage(`대국 종료! 현재 형세는 <strong>${scoreStr}</strong> 입니다.`);
          this.updateStatus('Analysis', `Game Over: ${scoreStr}`);
      } catch (e) {
          this.setTutorMessage("계가 과정에서 오류가 발생했습니다.");
      }
      this.isAiThinking = false;
  }

  async reset() {
    if (this.isAiThinking) return;
    await aiEngine.clearBoard();
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    this.turn = 1; this.lastMove = null; this.animations = [];
    this.analysis = { move: '', winRate: '50.0', reason: '대국을 시작해주세요.' };
    this.updateStatus('Last GTP Command', 'none');
    this.updateStatus('Analysis', 'Pending move...');
    this.setTutorMessage("새 판을 준비했습니다. 먼저 시작해보세요!");
    this.updateUI();
  }
}

window.game = new GoGame('go-board');
