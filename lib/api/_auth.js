function requireAdmin(req) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || expected.length < 24) throw Object.assign(new Error('ADMIN_SECRET missing/too short'),{statusCode:500});
  const supplied = req.headers['x-admin-secret'];
  if (supplied !== expected) throw Object.assign(new Error('Unauthorized'),{statusCode:401});
}
module.exports = { requireAdmin };
