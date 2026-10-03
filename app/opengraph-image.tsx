import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Integritas — Integrity in every cross-border decision";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #080808 0%, #11100d 55%, #080808 100%)",
          color: "#f7f5f0",
          padding: "72px 82px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ position: "absolute", inset: 28, border: "1px solid rgba(212,175,55,.35)" }} />
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            right: -150,
            top: 30,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,55,.18), rgba(212,175,55,0) 68%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 10, height: 10, transform: "rotate(45deg)", background: "#d4af37" }} />
            <div style={{ fontSize: 24, letterSpacing: 8, textTransform: "uppercase", color: "#d4af37" }}>Integritas</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 920 }}>
            <div style={{ fontSize: 66, lineHeight: 1.08, letterSpacing: -1 }}>
              Integrity in every
              <br />
              <span style={{ color: "#e5c07b", fontStyle: "italic" }}>cross-border decision.</span>
            </div>
            <div style={{ width: 110, height: 2, background: "#d4af37" }} />
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: "#aaa49a" }}>
              Legal · Business · Project Management Consulting
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
