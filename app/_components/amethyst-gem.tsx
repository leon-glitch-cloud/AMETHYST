export function AmethystGem() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F5F3FF",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "82%",
          height: "82%",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 55%, #6D28D9 100%)",
            clipPath:
              "polygon(50% 4%, 88% 30%, 88% 68%, 50% 96%, 12% 68%, 12% 30%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(76, 29, 149, 0.45)",
            clipPath: "polygon(28% 50%, 72% 50%, 50% 96%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "#EDE9FE",
            clipPath:
              "polygon(50% 16%, 73% 32%, 73% 50%, 50% 61%, 27% 50%, 27% 32%)",
          }}
        />
      </div>
    </div>
  );
}
