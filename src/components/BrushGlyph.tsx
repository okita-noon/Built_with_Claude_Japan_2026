// 地目などを漢字一文字のアイコンとして筆フォントで出す。補助ラベルは置かない。
export function BrushGlyph({ char, size = 24, className = "" }: { char: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`font-fude inline-block leading-none text-sumi-800 ${className}`}
      style={{ fontSize: size, lineHeight: 1 }}
    >
      {char}
    </span>
  );
}

export function ChimokuGlyph({ chimoku, size = 24 }: { chimoku: string; size?: number }) {
  const char = chimoku === "畑" ? "畑" : chimoku === "田" ? "田" : chimoku === "山林" ? "山" : chimoku === "宅地" ? "宅" : "？";
  return <BrushGlyph char={char} size={size} />;
}

// 筆ストロークのチェック・バツ・問い（簡素なSVG。描画は transform/opacity のみ）
export function BrushCheck({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M4 13 C 7 15, 9 17, 11 18 C 14 14, 17 9, 21 5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrushCross({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M5 5 C 10 9, 15 14, 19 19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M19 5 C 14 9, 10 14, 5 19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function BrushAsk({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M8 8 C 9 5, 15 5, 15 9 C 15 12, 12 12, 12 15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="19" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function BrushDot({ size = 10 }: { size?: number }) {
  return <span aria-hidden style={{ width: size, height: size, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />;
}
