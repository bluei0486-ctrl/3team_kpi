"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      name: "통합 대시보드",
      href: "/",
      icon: "📊",
    },
    {
      name: "엑셀 데이터 업로드",
      href: "/upload",
      icon: "📤",
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">3</div>
        <div className="sidebar-logo-text">3팀 영업 자동화</div>
      </div>
      
      <nav style={{ flexGrow: 1 }}>
        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                >
                  <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="user-avatar">3T</div>
        <div className="user-info">
          <span className="user-name">3팀 관리자</span>
          <span className="user-role">Administrator</span>
        </div>
      </div>
    </aside>
  );
}
