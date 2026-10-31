const { db } = require('./db');
const { pingUser } = require('./live');

function notify(userId, text, link = null) {
  db.prepare('INSERT INTO notifications (user_id, text, link, created_at) VALUES (?,?,?,?)').run(userId, text, link, new Date().toISOString());
  const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(userId).n;
  pingUser(userId, unread);
}

module.exports = { notify };
