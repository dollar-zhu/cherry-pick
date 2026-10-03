import Image from "next/image";

const LOCKUP = {
  white: { src: "/brand/lockup-white.png", width: 1200, height: 271 },
  color: { src: "/brand/lockup-color.png", width: 1200, height: 271 },
} as const;
const MARK = { src: "/brand/mark.png", width: 512, height: 512 } as const;

type LogoProps = {
  variant?: "full" | "mark";
  /** full only: white on dark surfaces (default), color only on white backgrounds. */
  tone?: "white" | "color";
  /** Rendered height in px. Width follows the artwork's ratio. */
  height?: number;
  className?: string;
};

export function Logo({ variant = "full", tone = "white", height = 22, className }: LogoProps) {
  const art = variant === "mark" ? MARK : LOCKUP[tone];
  return (
    <Image
      src={art.src}
      alt="cherrypick"
      height={height}
      width={Math.round((art.width / art.height) * height)}
      className={className}
    />
  );
}
