import { withTransaction } from '../database.js';

const userColumns = 'id, email, first_name AS firstName, last_name AS lastName, role';
const addressColumns = `a.id, saved.recipient_name AS recipientName, saved.phone,
  a.address_line AS addressLine, a.city, a.region, a.postal_code AS postalCode`;

export function createAccountStore(db) {
  return {
    async createUser({ email, passwordHash, firstName, lastName }) {
      const [result] = await db.execute(`INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES (?, ?, ?, ?, 'customer')`, [email, passwordHash, firstName, lastName]);
      return { id: result.insertId, email, firstName, lastName, role: 'customer' };
    },
    async findUserByEmail(email) {
      const [rows] = await db.execute(`SELECT ${userColumns}, password_hash AS passwordHash FROM users WHERE email = ?`, [email]);
      return rows[0] ?? null;
    },
    async findSession(tokenHash) {
      const [rows] = await db.execute(`SELECT s.token_hash AS tokenHash, s.csrf_token_hash AS csrfTokenHash,
        u.id, u.email, u.first_name AS firstName, u.last_name AS lastName, u.role
        FROM user_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()`, [tokenHash]);
      if (!rows.length) return null;
      const { tokenHash: stored, csrfTokenHash, ...user } = rows[0];
      return { tokenHash: stored, csrfTokenHash, user };
    },
    async createSession({ userId, tokenHash, csrfTokenHash, expiresAt, previousTokenHash }) {
      await withTransaction(db, async connection => {
        await connection.execute('DELETE FROM user_sessions WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP()', [userId]);
        await connection.execute('INSERT INTO user_sessions (token_hash, user_id, csrf_token_hash, expires_at) VALUES (?, ?, ?, ?)',
          [tokenHash, userId, csrfTokenHash, expiresAt]);
        if (previousTokenHash) await connection.execute('DELETE FROM user_sessions WHERE token_hash = ?', [previousTokenHash]);
      });
    },
    async updateCsrf(tokenHash, csrfTokenHash) {
      await db.execute('UPDATE user_sessions SET csrf_token_hash = ? WHERE token_hash = ?', [csrfTokenHash, tokenHash]);
    },
    async deleteSession(tokenHash) {
      await db.execute('DELETE FROM user_sessions WHERE token_hash = ?', [tokenHash]);
    },
    async listAddresses(userId) {
      const [rows] = await db.execute(`SELECT ${addressColumns} FROM user_address_links saved
        JOIN user_addresses a ON a.id = saved.address_id WHERE saved.user_id = ? ORDER BY a.id`, [userId]);
      return rows;
    },
    async createAddress(userId, address) {
      return withTransaction(db, async connection => {
        // LAST_INSERT_ID makes insertId return the shared location's ID even when it already exists.
        const [result] = await connection.execute(`INSERT INTO user_addresses (address_line, city, region, postal_code)
          VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [address.addressLine, address.city, address.region, address.postalCode]);
        await connection.execute(`INSERT INTO user_address_links (user_id, address_id, recipient_name, phone)
          VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE recipient_name = ?, phone = ?`,
        [userId, result.insertId, address.recipientName, address.phone, address.recipientName, address.phone]);
        const [rows] = await connection.execute(`SELECT ${addressColumns} FROM user_address_links saved
          JOIN user_addresses a ON a.id = saved.address_id WHERE saved.user_id = ? AND saved.address_id = ?`, [userId, result.insertId]);
        return rows[0];
      });
    }
  };
}
