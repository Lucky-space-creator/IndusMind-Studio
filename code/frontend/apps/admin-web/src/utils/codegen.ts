/** 业务编码自动生成工具：统一格式 前缀-yyyyMMdd-4 位随机小写字母数字 */

/** 随机字符表（小写字母 + 数字） */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** 取当天日期的 yyyyMMdd 串 */
function datePart(): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** 生成业务编码：prefix-yyyyMMdd-xxxx，如 TYPE-20261018-a3f7 */
export function genCode(prefix: string): string {
  let rand = "";
  for (let i = 0; i < 4; i++) {
    rand += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${datePart()}-${rand}`;
}