import crypto from "crypto";
import RefreshToken from "../models/refreshToken.js";
import { toJWT } from "../auth/jwt.js";

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function generateRefreshToken(userId: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await RefreshToken.create({
    tokenHash,
    UserId: userId,
    expiresAt,
  });

  return rawToken;
}

export async function refreshAccessToken(
  rawToken: string
): Promise<{ jwt: string; refreshToken: string; userId: number } | null> {
  const tokenHash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ where: { tokenHash } });

  if (!record) return null;
  if (record.expiresAt < new Date()) {
    await record.destroy();
    return null;
  }

  await record.destroy();

  const jwt = toJWT({ userId: record.UserId });
  const newRefreshToken = await generateRefreshToken(record.UserId);

  return { jwt, refreshToken: newRefreshToken, userId: record.UserId };
}

export async function revokeAllUserTokens(userId: number): Promise<void> {
  await RefreshToken.destroy({ where: { UserId: userId } });
}
