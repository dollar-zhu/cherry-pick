type GlowProps = {
  /** app: signed-in pages (27.5%). hero: login, onboarding, empty states (50%). */
  intensity?: "app" | "hero";
};

/** One fixed glow behind the page. Put page content in an `above-glow` wrapper. */
export function Glow({ intensity = "app" }: GlowProps) {
  return (
    <div aria-hidden="true" data-intensity={intensity} className="cp-glow">
      <div className="cp-glow-wash" />
      <div className="cp-glow-core" />
    </div>
  );
}
