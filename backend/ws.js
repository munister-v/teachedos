// Real-time board collaboration via WebSocket
// ws://api/ws?boardId=xxx&token=JWT
const { WebSocketServer } = require('ws');
const jwt  = require('jsonwebtoken');
const pool = require('./db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// boardId → Set<ws>
const rooms = new Map();

function broadcast(boardId, msg, exclude) {
  const room = rooms.get(boardId);
  if (!room) return;
  const text = JSON.stringify(msg);
  room.forEach(ws => {
    if (ws !== exclude && ws.readyState === 1 /* OPEN */) {
      ws.send(text);
    }
  });
}

function setup(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const url    = new URL(req.url, 'http://localhost');
    const token  = url.searchParams.get('token');
    const boardId = url.searchParams.get('boardId');

    if (!token || !boardId) { ws.close(4001, 'Missing params'); return; }

    // Verify JWT
    let userId;
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      userId = payload.sub;
    } catch {
      ws.close(4001, 'Unauthorized'); return;
    }

    // Verify board ownership
    const { rows } = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND user_id = $2', [boardId, userId]
    );
    if (!rows.length) { ws.close(4003, 'Forbidden'); return; }

    // Join room
    if (!rooms.has(boardId)) rooms.set(boardId, new Set());
    rooms.get(boardId).add(ws);

    ws.boardId = boardId;
    ws.userId  = userId;

    // Notify others
    broadcast(boardId, { type: 'peer_joined', userId }, ws);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.type) {
        // Client sends full board patch after any local change
        case 'board_patch':
          broadcast(boardId, { ...msg, userId }, ws);
          break;
        // Cursor / presence
        case 'cursor':
          broadcast(boardId, { type: 'cursor', userId, x: msg.x, y: msg.y }, ws);
          break;
        default:
          break;
      }
    });

    ws.on('close', () => {
      rooms.get(boardId)?.delete(ws);
      if (rooms.get(boardId)?.size === 0) rooms.delete(boardId);
      broadcast(boardId, { type: 'peer_left', userId });
    });

    ws.on('error', (err) => console.error('[ws]', err.message));

    ws.send(JSON.stringify({ type: 'connected', boardId, userId }));
  });

  console.log('[ws] WebSocket server ready');
}

module.exports = { setup };
