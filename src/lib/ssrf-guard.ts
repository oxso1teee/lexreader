import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Импорт статьи по URL дёргает fetch() на сервере с адресом, который вводит
// пользователь, — классический SSRF-вектор (можно достучаться до localhost,
// внутренней сети, cloud metadata endpoint и т.д.). Резолвим хост и проверяем
// реальный IP, а не только строку — иначе DNS rebinding обходит проверку.

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIPv4(normalized.slice("::ffff:".length));
  }
  return false;
}

export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Поддерживаются только ссылки http(s).");
  }

  const hostname = url.hostname;
  if (hostname === "localhost") {
    throw new Error("Эта ссылка недоступна для импорта.");
  }

  const directIpVersion = isIP(hostname);
  const addresses =
    directIpVersion > 0
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true }).catch(() => []);

  if (addresses.length === 0) {
    throw new Error("Не удалось найти сайт по этой ссылке.");
  }

  for (const { address } of addresses) {
    const isPrivate = isIP(address) === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);
    if (isPrivate) {
      throw new Error("Эта ссылка недоступна для импорта.");
    }
  }
}
