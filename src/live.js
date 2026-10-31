// Live updates. Server-Sent Events always work (no setup); with Firebase configured the same
// events are mirrored to Cloud Firestore so they also reach browsers behind Firebase Hosting.
const { mirror, inboxId } = require('./google/firebase');
const { SECRET } = require('./auth');

const streams = new Map(); // userId -> Set(res)

function subscribe(userId, res) {
  if (!streams.has(userId)) streams.set(userId, new Set());
  streams.get(userId).add(res);
  res.on('close', () => { streams.get(userId)?.delete(res); });
}

function push(userId, event) {
  for (const res of streams.get(userId) || []) res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// Someone got a notification.
function pingUser(userId, unread) {
  push(userId, { type: 'notify', unread });
  mirror(`inbox/${inboxId(userId, SECRET)}`, { unread });
}

// A bid board changed; tell everyone looking at it.
function pingBoard(reqId, userIds, summary) {
  for (const id of new Set(userIds)) push(id, { type: 'board', req: Number(reqId) });
  mirror(`boards/${reqId}`, summary);
}

setInterval(() => { for (const set of streams.values()) for (const res of set) res.write(': keep-alive\n\n'); }, 25000).unref();

module.exports = { subscribe, pingUser, pingBoard };
