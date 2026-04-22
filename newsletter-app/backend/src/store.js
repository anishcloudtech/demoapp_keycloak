// In-memory data store shared across routes — replace with a DB in production

const subscribers = [];
const notificationLogs = [];
const auditLogs = [];

module.exports = { subscribers, notificationLogs, auditLogs };
