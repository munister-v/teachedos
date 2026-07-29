// Real-time board collaboration via WebSocket
// ws://api/ws?boardId=xxx&token=JWT
const { WebSocketServer } = require('ws');
const jwt  = require('jsonwebtoken');
const pool = require('./db/pool');
const { filterBoardData } = require('./lib/boardVisibility');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// boardId → Set<ws>
const rooms = new Map();
// boardId → { followMode: bool, boardOwnerId: string }
const roomMeta = new Map();

// Board payloads are per-recipient: the same patch carries different cards to
// the teacher and to a student. Redacting only the HTTP GET would leak
// everything back the moment the teacher edited anything, because this used to
// fan the author's full board out to the whole room verbatim.
function carriesBoardData(msg) {
  return msg && (msg.type === 'board_patch' || msg.type === 'card_add' || msg.type === 'card_update');
}

function viewFor(msg, viewerId, ownerId) {
  if (!carriesBoardData(msg)) return msg;
  if (msg.type === 'board_patch' && msg.state) {
    return Object.assign({}, msg, { state: filterBoardData(msg.state, viewerId, ownerId) });
  }
  if (msg.type === 'board_patch' && msg.data) {
    return Object.assign({}, msg, { data: filterBoardData(msg.data, viewerId, ownerId) });
  }
  // Single-card messages: run the card through the same rule via a one-card board.
  if (msg.card) {
    const filtered = filterBoardData({ cards: [msg.card] }, viewerId, ownerId);
    if (!filtered.cards.length) return null;          // not entitled to know it exists
    return Object.assign({}, msg, { card: filtered.cards[0] });
  }
  return msg;
}

function broadcast(boardId, msg, exclude) {
  const room = rooms.get(boardId);
  if (!room) return;
  const ownerId = (roomMeta.get(boardId) || {}).boardOwnerId;
  const plain = carriesBoardData(msg) ? null : JSON.stringify(msg);
  room.forEach(ws => {
    if (ws === exclude || ws.readyState !== 1 /* OPEN */) return;
    if (plain !== null) { ws.send(plain); return; }
    const view = viewFor(msg, ws.userId, ownerId);
    if (view) ws.send(JSON.stringify(view));
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

    // Verify board access (owner or collaborator)
    const { rows } = await pool.query(`
      SELECT 1 FROM boards WHERE id = $1 AND user_id = $2
      UNION
      SELECT 1 FROM board_collaborators WHERE board_id = $1 AND user_id = $2
    `, [boardId, userId]);
    if (!rows.length) { ws.close(4003, 'Forbidden'); return; }

    // Get board owner
    const { rows: ownerRows } = await pool.query(
      'SELECT user_id FROM boards WHERE id=$1', [boardId]
    );
    const boardOwnerId = ownerRows[0]?.user_id;

    // Join room
    if (!rooms.has(boardId)) {
      rooms.set(boardId, new Set());
      roomMeta.set(boardId, { followMode: false, boardOwnerId });
    }
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
        // Drawing strokes — fan out as-is (state.strokes carries the latest set)
        case 'strokes_patch':
          if (Array.isArray(msg.strokes)) {
            broadcast(boardId, { type: 'strokes_patch', strokes: msg.strokes, userId }, ws);
          }
          break;
        // Per-object incremental updates (future-proofing — client may opt in)
        case 'card_update':
        case 'card_add':
        case 'card_delete':
        case 'arrow_add':
        case 'arrow_update':
        case 'arrow_delete':
        case 'stroke_add':
        case 'stroke_delete':
          broadcast(boardId, { ...msg, userId }, ws);
          break;
        // Cursor / presence
        case 'cursor':
          broadcast(boardId, { type: 'cursor', userId, x: msg.x, y: msg.y, name: msg.name, avatar: msg.avatar }, ws);
          break;
        // Selection awareness (who has what selected)
        case 'selection':
          broadcast(boardId, { type: 'selection', userId, cardIds: msg.cardIds || [], name: msg.name }, ws);
          break;
        // Teacher toggles Follow Me mode
        case 'follow_mode': {
          const meta = roomMeta.get(boardId);
          if (meta) meta.followMode = !!msg.enabled;
          broadcast(boardId, { type: 'follow_mode', enabled: !!msg.enabled, userId }, ws);
          break;
        }
        // Any client broadcasts their viewport position
        case 'viewport':
          broadcast(boardId, {
            type: 'viewport', userId,
            pan: msg.pan, scale: msg.scale,
            name: msg.name, avatar: msg.avatar,
          }, ws);
          break;
        default:
          break;
      }
    });

    ws.on('close', () => {
      rooms.get(boardId)?.delete(ws);
      if (rooms.get(boardId)?.size === 0) {
        rooms.delete(boardId);
        roomMeta.delete(boardId);
      }
      broadcast(boardId, { type: 'peer_left', userId });
    });

    ws.on('error', (err) => console.error('[ws]', err.message));

    // Send initial state to new joiner
    const meta = roomMeta.get(boardId);
    ws.send(JSON.stringify({
      type: 'connected', boardId, userId, boardOwnerId,
      followMode: meta?.followMode || false,
    }));
  });

  console.log('[ws] WebSocket server ready');
}

module.exports = { setup };
