const crypto = require("crypto");

const SECRET = process.env.SECRET_VERIFICATION_KEY;

function generateSignature(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

function verifySignature(data, receivedSignature) {
  const expectedSignature = generateSignature(data);

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(receivedSignature, "hex")
  );

  return isValid ? "Authorized" : "Unauthorized";
}

module.exports = {
  verifySignature
};