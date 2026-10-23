export async function renderWinnerImage(g, w, outFormat='jpeg', opts={}) {
  const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1a1a2e" /><text x="400" y="100" font-family="sans-serif" font-size="40" fill="#ffffff" text-anchor="middle">GIVEAWAY WINNER</text><text x="400" y="200" font-family="sans-serif" font-size="60" font-weight="bold" fill="#facc15" text-anchor="middle">${w.winner_label || 'Winner'}</text><text x="400" y="300" font-family="sans-serif" font-size="30" fill="#9ca3af" text-anchor="middle">${g.title || ''}</text></svg>`;
  return new TextEncoder().encode(svg);
}
