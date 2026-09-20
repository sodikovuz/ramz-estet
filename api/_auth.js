function requireAdmin(req) {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    throw new Error("ADMIN_SECRET is missing");
  }

  const supplied = req.headers["x-admin-secret"];

  if (!supplied || supplied !== expected) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

module.exports = { requireAdmin };
