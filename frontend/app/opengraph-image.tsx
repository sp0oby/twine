import {ImageResponse} from "next/og";

export const runtime = "edge";
export const alt = "Twine — A market for the spread";
export const size = {width: 1200, height: 630};
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          background: "#000",
          color: "#f5f1ea",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#9b9690",
            display: "flex",
          }}
        >
          TWINE
        </div>
        <div style={{display: "flex", flexDirection: "column", gap: 28}}>
          <div
            style={{
              fontSize: 88,
              letterSpacing: "-0.025em",
              lineHeight: 1.02,
              fontWeight: 500,
              maxWidth: 980,
            }}
          >
            A market for the spread.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#c8c4be",
              maxWidth: 920,
              lineHeight: 1.4,
            }}
          >
            A Uniswap v4 hook for trading the spread between two correlated assets. Launch pair: tokenized Strategy against Bitcoin, on Base.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#9b9690",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span>twine.market</span>
          <span>Pre-launch · Base Sepolia</span>
        </div>
      </div>
    ),
    {...size},
  );
}
