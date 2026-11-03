export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "text-6xl" : size === "md" ? "text-3xl" : "text-xl";
  return (
    <div className="flex items-baseline gap-3 select-none">
      <span className={`font-fude ${s} text-sumi-900 leading-none`}>筆のこえ</span>
    </div>
  );
}
