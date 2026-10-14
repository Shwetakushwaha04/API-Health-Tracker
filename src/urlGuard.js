const dns = require("dns").promises;
const net = require("net");

// A monitoring tool makes requests to URLs that users type in. Without a
// check, someone could point it at internal addresses (localhost, cloud
// metadata, private networks). This module rejects those targets.
// Set ALLOW_PRIVATE_URLS=true to turn the check off (local development/tests).

function isPrivateIPv4(ip) {
  const [a, b] = ip.split(".").map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast / reserved
  );
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase();

  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // unique local
  if (value.startsWith("fe8") || value.startsWith("fe9")) return true; // link-local
  if (value.startsWith("fea") || value.startsWith("feb")) return true;

  // IPv4-mapped addresses such as ::ffff:127.0.0.1
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unknown format: treat as unsafe
}

function privateUrlsAllowed() {
  return process.env.ALLOW_PRIVATE_URLS === "true";
}

// Quick, synchronous check used when a user adds an API.
// Returns an error message, or null if the URL looks fine.
function validateUrlFormat(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return "URL is not valid. Example: https://api.example.com/health";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http:// and https:// URLs are allowed";
  }

  if (privateUrlsAllowed()) return null;

  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost")) {
    return "Local addresses are not allowed";
  }

  if (net.isIP(host) && isPrivateIp(host)) {
    return "Private or internal IP addresses are not allowed";
  }

  return null;
}

// Stricter check run right before every request: resolves the hostname and
// makes sure it does not point to a private address.
// Returns an error message, or null if the target is safe.
async function checkResolvedHost(rawUrl) {
  if (privateUrlsAllowed()) return null;

  const host = new URL(rawUrl).hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(host)) {
    return isPrivateIp(host) ? "Private address blocked" : null;
  }

  try {
    const results = await dns.lookup(host, { all: true });

    if (results.some((entry) => isPrivateIp(entry.address))) {
      return "Host resolves to a private address";
    }

    return null;
  } catch {
    return "Host could not be resolved";
  }
}

module.exports = { validateUrlFormat, checkResolvedHost, isPrivateIp };
