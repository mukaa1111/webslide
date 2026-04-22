import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      color: "var(--label-alternative)",
    }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, color: "var(--label-strong)" }}>
        404
      </h1>
      <p>페이지를 찾을 수 없습니다.</p>
      <Link href="/" style={{ color: "var(--primary-normal)", fontWeight: 600, textDecoration: "none" }}>
        홈으로 돌아가기
      </Link>
    </div>
  );
}
