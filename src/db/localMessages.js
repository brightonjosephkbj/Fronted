import * as SQLite from 'expo-sqlite';

export const AI_USER_ID = 0;
const db = SQLite.openDatabaseSync('b24_messages.db');

function initLocalDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER,
      content TEXT,
      media_type TEXT,
      media_url TEXT,
      ts INTEGER NOT NULL,
      from_me INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);

    CREATE TABLE IF NOT EXISTS group_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      sender_username TEXT,
      sender_color TEXT,
      sender_verified INTEGER,
      content TEXT,
      media_type TEXT,
      media_url TEXT,
      ts INTEGER NOT NULL,
      from_me INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id);
  `);
}
initLocalDb();

export function saveLocalMessage(msg) {
  db.runSync(
    `INSERT OR REPLACE INTO messages (id, chat_id, sender_id, recipient_id, content, media_type, media_url, ts, from_me)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(msg.id),
      String(msg.chatId),
      msg.senderId,
      msg.recipientId ?? null,
      msg.content ?? '',
      msg.mediaType ?? 'text',
      msg.mediaUrl ?? null,
      msg.ts,
      msg.fromMe ? 1 : 0,
    ]
  );
}

export function getLocalMessages(chatId) {
  return db.getAllSync(`SELECT * FROM messages WHERE chat_id = ? ORDER BY ts ASC`, [String(chatId)]);
}

export function saveLocalGroupMessage(msg) {
  db.runSync(
    `INSERT OR REPLACE INTO group_messages (id, group_id, sender_id, sender_username, sender_color, sender_verified, content, media_type, media_url, ts, from_me)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(msg.id),
      String(msg.groupId),
      msg.senderId,
      msg.senderUsername ?? null,
      msg.senderColor ?? null,
      msg.senderVerified ? 1 : 0,
      msg.content ?? '',
      msg.mediaType ?? 'text',
      msg.mediaUrl ?? null,
      msg.ts,
      msg.fromMe ? 1 : 0,
    ]
  );
}

export function getLocalGroupMessages(groupId) {
  return db.getAllSync(`SELECT * FROM group_messages WHERE group_id = ? ORDER BY ts ASC`, [String(groupId)]);
}

export async function syncPendingMessages(apiRequest, myUserId) {
  try {
    const res = await apiRequest('/messages/pending');
    const list = res?.messages || [];
    const idsToAck = [];
    for (const m of list) {
      saveLocalMessage({
        id: m.id,
        chatId: String(m.sender_id === myUserId ? m.recipient_id : m.sender_id),
        senderId: m.sender_id,
        recipientId: m.recipient_id,
        content: m.content,
        mediaType: m.media_type,
        mediaUrl: m.media_url,
        ts: m.timestamp,
        fromMe: m.sender_id === myUserId,
      });
      if (m.sender_id !== AI_USER_ID && m.recipient_id !== AI_USER_ID) idsToAck.push(m.id);
    }
    if (idsToAck.length) {
      await apiRequest('/messages/ack', { method: 'POST', body: JSON.stringify({ ids: idsToAck }) });
    }
  } catch (e) {
    // offline - local data stays as-is, that's the point
  }

  try {
    const gres = await apiRequest('/groups/messages/pending');
    const glist = gres?.messages || [];
    const gIds = [];
    for (const m of glist) {
      saveLocalGroupMessage({
        id: m.id,
        groupId: m.group_id,
        senderId: m.sender_id,
        senderUsername: m.sender_username,
        senderColor: m.sender_color,
        senderVerified: m.sender_verified,
        content: m.content,
        mediaType: m.media_type,
        mediaUrl: m.media_url,
        ts: m.timestamp,
        fromMe: m.sender_id === myUserId,
      });
      gIds.push(m.id);
    }
    if (gIds.length) {
      await apiRequest('/groups/messages/ack', { method: 'POST', body: JSON.stringify({ ids: gIds }) });
    }
  } catch (e) {
    // offline
  }
}
