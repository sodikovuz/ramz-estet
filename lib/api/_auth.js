function requireAdmin(req) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) throw new Error("ADMIN_SECRET is missing");
  if (req.headers["x-admin-secret"] !== expected) {
    const e = new Error("Unauthorized");
    e.statusCode = 401;
    throw e;
  }
}
module.exports = { requireAdmin };
