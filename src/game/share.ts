export const SITE = "https://jade-garden-n8lk.vercel.app";

export const X_POST =
  "Jade Garden — mahjong under a moonlit pond. Match the free tiles. If the path closes, leave your name on the board.";

export function xIntent(line?: string) {
  const text = line ? `${line}\n\n${X_POST}` : X_POST;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE)}`;
}
