const crypto = require("crypto");

const SECRET = process.env.SECRET_VERIFICATION_KEY;

function generateSignature(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

function verifySignature(data, receivedSignature) {
  if (!receivedSignature || typeof receivedSignature !== "string") {
    console.warn("Received signature is missing or not a string.");
    return "Unauthorized";
  }

  const expectedSignature = generateSignature(data);

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(receivedSignature.trim(), "hex");

    // FIX: check length before comparing
    if (expectedBuffer.length !== receivedBuffer.length) {
        console.warn("Signature length mismatch. Possible tampering detected.");
        console.warn(`Expected signature: ${expectedSignature}`);
        console.warn(`Received signature: ${receivedSignature}`);
        console.warn(`Expected signature length: ${expectedBuffer.length}, Received signature length: ${receivedBuffer.length}`);

      return "Unauthorized";
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    console.log(`Signature verification result: ${isValid ? "Authorized" : "Unauthorized"}`);

    return isValid ? "Authorized" : "Unauthorized";
  } catch (err) {
    // handles invalid hex etc.
    return "Unauthorized";
  }
}

module.exports = {
  verifySignature
};