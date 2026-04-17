const crypto = require("crypto");

const SECRET = process.env.SECRET_VERIFICATION_KEY;

function generateSignature(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

function verifySignature(data, receivedSignature) {
  if (!receivedSignature || typeof receivedSignature !== "string") {
    return "Unauthorized";
  }

  const expectedSignature = generateSignature(data);

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(receivedSignature.trim(), "hex");

    // 🔥 FIX: check length before comparing
    if (expectedBuffer.length !== receivedBuffer.length) {
      return "Unauthorized";
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    return isValid ? "Authorized" : "Unauthorized";
  } catch (err) {
    // handles invalid hex etc.
    return "Unauthorized";
  }
}

module.exports = {
  verifySignature
};