import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ALGORITHM = "aes-256-cbc";
// Key must be 32 bytes (256 bits). If env var is short, we pad or hash it.
// For production, ensure process.env.ENCRYPTION_KEY is a strong 32-char string.
const ENCRYPTION_KEY = crypto
    .createHash("sha256")
    .update(String(process.env.ENCRYPTION_KEY || "fallback_secret_key"))
    .digest("base64")
    .substr(0, 32);

const IV_LENGTH = 16; // For AES, this is always 16

export const encrypt = (text) => {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
};

export const decrypt = (text) => {
    if (!text) return null;
    try {
        const textParts = text.split(":");
        const iv = Buffer.from(textParts.shift(), "hex");
        const encryptedText = Buffer.from(textParts.join(":"), "hex");
        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            Buffer.from(ENCRYPTION_KEY),
            iv
        );
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        console.error("Decryption failed:", err.message);
        return null;
    }
};
