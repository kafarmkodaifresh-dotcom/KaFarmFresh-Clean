export const today = () => new Date().toISOString().split("T")[0];

export const fmtDate = d => {
  if (!d) return "";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
};

export const fmtNum = n => Number(n || 0).toLocaleString("en-IN");