// Real-time board collaboration via WebSocket
// ws://api/ws?boardId=xxx with the JWT carried in Sec-WebSocket-Protocol.
const { WebSocketServer } = require('ws');
const pool = require('./db/pool');
const { filterBoardData } = require('./lib/boardVisibility');
const { sanitizeBoardData } = require('./lib/boardSanitize');
const { authenticateToken } = require('./middleware/auth');

const APP_PROTOCOL = 'teached-v1';
const TOKEN_PROTOCOL_PREFIX = 'teached.jwt.';
// The current client syncs complete board snapshots. Non-owner snapshots may
// be redacted (private / unrevealed cards), so accepting one would erase data
// the collaborator never received. Keep collaboration read-only until edits
// are expressed as per-object operations that can be merged server-side.
const EDIT_ROLES = new Set(['owner']);
const MUTATION_TYPES = new Set([
  'board_patch', 'strokes_patch', 'card_update', 'card_add', 'card_delete',
  'arrow_add', 'arrow_update', 'arrow_delete', 'stroke_add', 'stroke_delete',
]);

function tokenFromProtocols(req) {
  const protocols = String(req.headers['sec-websocket-protocol'] || '')
    .split(',')
    .map(value => value.trim());
  const authProtocol = protocols.find(value => value.startsWith(TOKEN_PROTOCOL_PREFIX));
  return authProtocol ? authProtocol.slice(TOKEN_PROTOCOL_PREFIX.length) : '';
}

function safeBoardPatch(msg) {
  if (!msg?.state || typeof msg.state !== 'object' || !Array.isArray(msg.state.cards)) return null;
  if (msg.state.cards.length > 5000) return null;
  return {
    type: 'board_patch',
    state: sanitizeBoardData({
      cards: msg.state.cards,
      arrows: Array.isArray(msg.state.arrows) ? msg.state.arrows : [],
      annotations: Array.isArray(msg.state.annotations) ? msg.state.annotations : [],
      strokes: Array.isArray(msg.state.strokes) ? msg.state.strokes : [],
      nextId: Number.isFinite(Number(msg.state.nextId)) ? Number(msg.state.nextId) : 1,
    }),
  };
}

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
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 12 * 1024 * 1024,
    perMessageDeflate: false,
    handleProtocols(protocols) {
      return protocols.has(APP_PROTOCOL) ? APP_PROTOCOL : false;
    },
  });

  wss.on('connection', async (ws, req) => {
    const url    = new URL(req.url, 'http://localhost');
    const token  = tokenFromProtocols(req);
    const boardId = url.searchParams.get('boardId');

    if (!token || !boardId) { ws.close(4001, 'Missing params'); return; }

    let authenticated;
    try {
      authenticated = await authenticateToken(token);
    } catch {
      ws.close(4001, 'Unauthorized'); return;
    }
    const userId = authenticated.user.id;

    let access;
    try {
      const { rows } = await pool.query(`
        SELECT b.user_id AS owner_id,
               CASE WHEN b.user_id=$2 THEN 'owner' ELSE bc.role END AS access_role
          FROM boards b
          LEFT JOIN board_collaborators bc
            ON bc.board_id=b.id AND bc.user_id=$2
         WHERE b.id=$1 AND (b.user_id=$2 OR bc.user_id=$2)
         LIMIT 1
      `, [boardId, userId]);
      access = rows[0];
    } catch {
      ws.close(1011, 'Access check failed'); return;
    }
    if (!access) { ws.close(4003, 'Forbidden'); return; }

    const boardOwnerId = access.owner_id;
    const accessRole = access.access_role || 'viewer';
    const canEdit = EDIT_ROLES.has(accessRole);

    // Join room
    if (!rooms.has(boardId)) {
      rooms.set(boardId, new Set());
      roomMeta.set(boardId, { followMode: false, boardOwnerId });
    }
    rooms.get(boardId).add(ws);

    ws.boardId = boardId;
    ws.userId  = userId;
    ws.accessRole = accessRole;
    ws.canEdit = canEdit;

    // Notify others
    broadcast(boardId, { type: 'peer_joined', userId }, ws);

    let messageWindowStartedAt = Date.now();
    let messagesInWindow = 0;
    ws.on('message', (raw) => {
      const now = Date.now();
      if (now - messageWindowStartedAt >= 10_000) {
        messageWindowStartedAt = now;
        messagesInWindow = 0;
      }
      messagesInWindow += 1;
      if (messagesInWindow > 600) {
        ws.close(4008, 'Rate limit exceeded');
        return;
      }

      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
      if (MUTATION_TYPES.has(msg.type) && !canEdit) {
        ws.send(JSON.stringify({ type: 'permission_denied', action: msg.type }));
        return;
      }

      switch (msg.type) {
        // Client sends full board patch after any local change
        case 'board_patch': {
          const patch = safeBoardPatch(msg);
          if (patch) broadcast(boardId, { ...patch, userId }, ws);
          break;
        }
        // Drawing strokes - fan out as-is (state.strokes carries the latest set)
        case 'strokes_patch':
          if (Array.isArray(msg.strokes)) {
            broadcast(boardId, { type: 'strokes_patch', strokes: msg.strokes, userId }, ws);
          }
          break;
        // Per-object incremental updates (future-proofing - client may opt in)
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
          broadcast(boardId, {
            type: 'cursor', userId, x: Number(msg.x) || 0, y: Number(msg.y) || 0,
            name: authenticated.user.name, avatar: authenticated.user.avatar,
          }, ws);
          break;
        // Selection awareness (who has what selected)
        case 'selection':
          broadcast(boardId, {
            type: 'selection', userId,
            cardIds: Array.isArray(msg.cardIds) ? msg.cardIds.slice(0, 500) : [],
            name: authenticated.user.name,
          }, ws);
          break;
        // Teacher toggles Follow Me mode
        case 'follow_mode': {
          if (accessRole !== 'owner') {
            ws.send(JSON.stringify({ type: 'permission_denied', action: msg.type }));
            break;
          }
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
            name: authenticated.user.name, avatar: authenticated.user.avatar,
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
      accessRole, canEdit,
      followMode: meta?.followMode || false,
    }));
  });

  console.log('[ws] WebSocket server ready');
}

module.exports = { setup };
