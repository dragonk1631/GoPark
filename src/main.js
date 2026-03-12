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
    this.padding = 45; // Increased padding for coordinates
    this.innerPadding = 20;
    this.cellSize = (this.canvas.width - this.padding * 2) / (size - 1);
    this.isAiThinking = false;
    this.lastMove = null;
    this.analysis = { move: '', winRate: '50.0', reason: '대국을 시작해주세요.' };

    this.init();
  }

  async init() {
    this.render();
    this.canvas.addEventListener('mousedown', (e) => this.handleCanvasClick(e));
    document.getElementById('reset-btn').addEventListener('click', () => this.reset());

    try {
      this.setTutorMessage("AI 엔진(Worker) 활성화 중...");
      this.updateStatus('AI Engine (WASM) Status', '[cite: Initializing...]', 'secondary');
      
      await aiEngine.init();
      await aiEngine.setBoardSize(this.size).catch(() => {});
      
      this.updateStatus('AI Engine (WASM) Status', '[cite: Running]', 'running');
      this.setTutorMessage("안녕하세요! 저는 AI Tutor 고요정입니다. <br>대국을 시작하시겠어요?");
    } catch (error) {
      console.error('AI Initialization failed:', error);
      this.updateStatus('AI Engine (WASM) Status', '[cite: Error]', 'error');
      this.setTutorMessage("AI 가동에 지연이 발생하고 있습니다. 잠시 후 대국을 시작해주세요.");
    }
  }

  updateStatus(label, value, type = '') {
      if (label.includes('Status')) {
          const el = document.getElementById('ai-status');
          if (el) {
              el.innerText = value;
              el.className = 'value ' + (type === 'running' ? 'status-running' : '');
          }
      } else if (label.includes('Command')) {
          const el = document.getElementById('last-command');
          if (el) el.innerText = value;
      } else if (label.includes('Analysis')) {
          const el = document.getElementById('analysis-text');
          if (el) el.innerText = value;
          const pctEl = document.getElementById('analysis-percentage');
          if (pctEl) pctEl.innerText = `(cite: ${this.analysis.winRate}%)`;
      }
  }

  toGtp(x, y) {
    const col = COL_NAMES[x];
    const row = this.size - y;
    return `${col}${row}`;
  }

  fromGtp(gtp) {
    if (!gtp || gtp.toUpperCase() === 'PASS') return null;
    const colChar = gtp[0].toUpperCase();
    const x = COL_NAMES.indexOf(colChar);
    if (x === -1) return null;
    const rowPart = gtp.substring(1).toUpperCase();
    const y = this.size - parseInt(rowPart);
    return { x, y };
  }

  render() {
    this.drawBoard();
    this.drawStones();
    if (this.lastMove) this.drawLastMoveLabel();
  }

  drawBoard() {
    const { ctx, padding, cellSize, size } = this;
    
    // Board Shadow
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowOffsetY = 10;
    
    // Board Wood Texture/Color
    const gradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, '#e3a857');
    gradient.addColorStop(1, '#c18a3e');
    ctx.fillStyle = gradient;
    ctx.fillRect(padding - 20, padding - 20, (size-1)*cellSize + 40, (size-1)*cellSize + 40);
    
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Grid lines
    ctx.strokeStyle = 'rgba(74, 55, 40, 0.8)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let i = 0; i < size; i++) {
      // Horizontal
      ctx.moveTo(padding, padding + i * cellSize);
      ctx.lineTo(this.canvas.width - padding, padding + i * cellSize);
      // Vertical
      ctx.moveTo(padding + i * cellSize, padding);
      ctx.lineTo(padding + i * cellSize, this.canvas.height - padding);
    }
    ctx.stroke();

    // Flowers (Hoshi)
    if (size === 19) {
      const hoshiPoints = [3, 9, 15];
      ctx.fillStyle = '#4a3728';
      for (let x of hoshiPoints) {
        for (let y of hoshiPoints) {
          ctx.beginPath();
          ctx.arc(padding + x * cellSize, padding + y * cellSize, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Coordinates
    ctx.fillStyle = '#4a3728';
    ctx.font = 'bold 12px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < size; i++) {
        // Horizontal Labels (A-T)
        const label = COL_NAMES[i];
        ctx.fillText(label, padding + i * cellSize, padding - 30);
        ctx.fillText(label, padding + i * cellSize, this.canvas.height - padding + 30);
        
        // Vertical Labels (1-19)
        const rowLabel = (size - i).toString();
        ctx.fillText(rowLabel, padding - 30, padding + i * cellSize);
        ctx.fillText(rowLabel, this.canvas.width - padding + 30, padding + i * cellSize);
    }
  }

  drawStones() {
    const { ctx, padding, cellSize } = this;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const stone = this.board[y][x];
        if (stone !== 0) {
          this.drawSingleStone(x, y, stone);
        }
      }
    }
  }

  drawSingleStone(x, y, color) {
    const { ctx, padding, cellSize } = this;
    const centerX = padding + x * cellSize;
    const centerY = padding + y * cellSize;
    const radius = cellSize * 0.46;

    // Stone Shadow
    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowOffsetY = 3;
    ctx.shadowOffsetX = 2;

    const grad = ctx.createRadialGradient(
        centerX - radius * 0.3, 
        centerY - radius * 0.3, 
        radius * 0.1, 
        centerX, centerY, radius
    );

    if (color === 1) { // Black
        grad.addColorStop(0, '#555');
        grad.addColorStop(1, '#111');
    } else { // White
        grad.addColorStop(0, '#fff');
        grad.addColorStop(1, '#ccc');
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Highlight ring for white stones
    if (color === 2) {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
  }

  drawLastMoveLabel() {
      if (!this.lastMove) return;
      const { ctx, padding, cellSize } = this;
      const x = this.lastMove.x;
      const y = this.lastMove.y;
      const centerX = padding + x * cellSize;
      const centerY = padding + y * cellSize;
      const label = this.toGtp(x, y);

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 11px Outfit';
      const textWidth = ctx.measureText(label).width;
      
      ctx.beginPath();
      ctx.roundRect(centerX - textWidth/2 - 4, centerY + 18, textWidth + 8, 18, 4);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, centerX, centerY + 27);

      // Current move indicator on stone
      ctx.strokeStyle = this.board[y][x] === 1 ? 'white' : 'black';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, cellSize * 0.2, 0, Math.PI * 2);
      ctx.stroke();
  }

  async handleCanvasClick(e) {
    if (this.turn !== 1 || this.isAiThinking) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const xCoord = (e.clientX - rect.left) * scaleX;
    const yCoord = (e.clientY - rect.top) * scaleY;
    
    const x = Math.round((xCoord - this.padding) / this.cellSize);
    const y = Math.round((yCoord - this.padding) / this.cellSize);
    
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      await this.playerMove(x, y);
    }
  }

  async playerMove(x, y) {
    if (this.board[y][x] !== 0) return;
    const coord = this.toGtp(x, y);
    try {
      this.isAiThinking = true;
      this.updateStatus('Last GTP Command', `play black ${coord.toLowerCase()}`);
      
      const res = await aiEngine.playMove('black', coord);
      if (res.startsWith('?')) {
        this.setTutorMessage("그 자리는 착수가 금지된 곳이거나 이미 돌이 있습니다.");
        this.isAiThinking = false;
        await this.syncBoard();
        return;
      }

      this.board[y][x] = 1;
      this.lastMove = { x, y };
      this.render();
      this.turn = 2;
      this.updateUI();
      
      setTimeout(() => this.aiMove(), 600);
    } catch (e) {
      console.warn('Move failed:', e);
      this.isAiThinking = false;
    }
  }

  async aiMove() {
    this.isAiThinking = true;
    this.setTutorMessage("음... 어디가 좋을까요? 생각 중입니다...");
    try {
      const gtpMove = await aiEngine.getMove('white');
      this.updateStatus('Last GTP Command', `genmove white -> ${gtpMove}`);
      
      if (gtpMove === 'PASS') {
        this.setTutorMessage("제가 이번 차례는 패스하겠습니다. 계속 두시겠어요?");
      } else if (gtpMove === 'ERROR') {
        this.setTutorMessage("시스템 오류가 발생했습니다.");
      } else {
        await this.syncBoard();
        const pos = this.fromGtp(gtpMove);
        if (pos) this.lastMove = pos;
        this.updateTutorAfterMove(gtpMove, false);
      }
      this.turn = 1;
      this.isAiThinking = false;
      this.updateUI();
      this.requestTutorHint();
    } catch (error) {
      this.setTutorMessage("AI가 수순을 찾는 데 어려움을 겪고 있습니다.");
      this.isAiThinking = false;
    }
  }

  async requestTutorHint() {
    if (this.turn !== 1) return;
    try {
        const hint = await aiEngine.getTutorHint('black');
        if (hint && hint.move !== 'PASS') {
            this.analysis = { 
                move: hint.move, 
                winRate: hint.winRate, 
                reason: hint.reason 
            };
            this.setTutorMessage(`${hint.move} 급소네요!<br>좋은 한 수입니다.`);
            this.updateStatus('Analysis', hint.reason);
        }
    } catch (e) {
        console.warn('Tutor hint failed:', e);
    }
  }

  async syncBoard() {
    try {
      const blackStones = await aiEngine.listStones('black');
      const whiteStones = await aiEngine.listStones('white');
      if (blackStones === null && whiteStones === null) return;
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) this.board[y][x] = 0;
      }
      if (blackStones) {
        for (const coord of blackStones) {
          const pos = this.fromGtp(coord);
          if (pos) this.board[pos.y][pos.x] = 1;
        }
      }
      if (whiteStones) {
        for (const coord of whiteStones) {
          const pos = this.fromGtp(coord);
          if (pos) this.board[pos.y][pos.x] = 2;
        }
      }
      this.render();
    } catch (err) {
      console.warn('Sync failed:', err);
    }
  }

  updateTutorAfterMove(coord, isPlayer) {
    const messages = isPlayer ? [`멋진 수네요! ${coord}라니!`] : [`저는 ${coord}에 두겠습니다.`];
    this.setTutorMessage(messages[0]);
  }

  setTutorMessage(msg) {
    const el = document.getElementById('tutor-message');
    if (el) el.innerHTML = msg;
  }

  updateUI() {
    const turnEl = document.getElementById('current-turn');
    if (!turnEl) return;
    turnEl.innerText = this.turn === 1 ? '흑번 (나)' : '백번 (상대)';
  }

  async reset() {
    if (this.isAiThinking) return;
    await aiEngine.clearBoard();
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    this.turn = 1;
    this.lastMove = null;
    this.analysis = { move: '', winRate: '50.0', reason: '대국을 시작해주세요.' };
    this.updateStatus('Last GTP Command', 'none');
    this.updateStatus('Analysis', 'Pending move...');
    this.setTutorMessage("새 판을 준비했습니다. 먼저 시작해보세요!");
    this.render();
    this.updateUI();
  }
}

window.game = new GoGame('go-board');
