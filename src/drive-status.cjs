function describeAccess(info) {
  const grants = info.permissions?.filter(p => !p.deleted && !p.view);
  if (!grants?.length) return "Access unavailable";
  if (grants.some(p => p.type === "anyone" && p.allowFileDiscovery)) return "Public on the web";
  if (grants.some(p => p.type === "anyone")) return "Anyone with the link";
  if (grants.some(p => p.type === "domain")) return "Organization access";
  if (grants.some(p => p.role !== "owner")) return "Specific people or groups";
  return info.ownedByMe ? "Private · only you" : "Restricted";
}
module.exports = { describeAccess };
