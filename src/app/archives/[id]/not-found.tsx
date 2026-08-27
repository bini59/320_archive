import Link from "next/link";
import { BoxIcon } from "@/app/icons";

export default function ArchiveNotFound() {
  return (
    <main className="page">
      <div className="card">
        <div className="empty">
          <span className="empty-mark"><BoxIcon size={17} /></span>
          <strong>아카이브를 찾을 수 없습니다</strong>
          <p>주소가 올바른지 확인하거나 새 URL을 보관해 주세요.</p>
          <Link className="btn" href="/">홈으로 돌아가기</Link>
        </div>
      </div>
    </main>
  );
}
