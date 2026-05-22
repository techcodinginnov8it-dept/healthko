"use client";

import type { ReactNode } from "react";
import type { DashboardRole, ModuleId } from "@/lib/dashboard/types";

export type DashboardNavItem<TModule extends ModuleId> = {
  id: TModule;
  label: string;
  badge?: number;
};

function NavIcon({ id }: { id: ModuleId }) {
  const iconClass = "h-4 w-4";

  switch (id) {
    case "overview":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 13h8V3H3v10Z" />
          <path d="M13 21h8V11h-8v10Z" />
          <path d="M13 3v6h8V3h-8Z" />
          <path d="M3 21h8v-6H3v6Z" />
        </svg>
      );
    case "schedule":
    case "book":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <path d="M3 10h18" />
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <path d="m9 16 2 2 4-5" />
        </svg>
      );
    case "live":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 10.5 21 7v10l-6-3.5" />
          <rect x="3" y="6" width="12" height="12" rx="3" />
        </svg>
      );
    case "patients":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "history":
    case "prescriptions":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6" />
          <path d="M9 15h6" />
        </svg>
      );
    case "settings":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2l-.13.72a2 2 0 0 1-2.83 1.17l-.64-.36a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.61.43a2 2 0 0 1 0 3.4l-.61.43a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.64-.36a2 2 0 0 1 2.83 1.17l.13.72a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2l.13-.72a2 2 0 0 1 2.83-1.17l.64.36a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.61-.43a2 2 0 0 1 0-3.4l.61-.43a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.64.36a2 2 0 0 1-2.83-1.17L14.22 4a2 2 0 0 0-2-2Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
  }
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
    </svg>
  );
}

export function DashboardShell<TModule extends ModuleId>({
  role,
  activeModule,
  navItems,
  title,
  subtitle,
  profile,
  connectionState,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onLogout,
  children,
}: {
  role: DashboardRole;
  activeModule: TModule;
  navItems: DashboardNavItem<TModule>[];
  title: string;
  subtitle: string;
  profile: {
    name: string;
    detail: string;
    meta?: string;
  };
  connectionState: "connected" | "reconnecting" | "offline";
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (module: TModule) => void;
  onLogout: () => ReactNode;
  children: ReactNode;
}) {
  const isDoctor = role === "doctor";
  const shellBg = isDoctor ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const sidebarBg = isDoctor ? "bg-slate-950 border-slate-850" : "bg-white border-slate-200";
  const muted = isDoctor ? "text-slate-400" : "text-slate-500";
  const navIdle = isDoctor
    ? "text-slate-400 hover:bg-slate-900 hover:text-white"
    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950";
  const overviewModule = navItems.find((item) => item.id === "overview")?.id;

  return (
    <div className={`min-h-screen ${shellBg} font-sans lg:flex`}>
      <aside
        className={`hidden lg:flex ${collapsed ? "w-24" : "w-80"} shrink-0 flex-col justify-between border-r ${sidebarBg} p-5 transition-all duration-300`}
        aria-label={`${role} dashboard navigation`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (overviewModule) {
                  onNavigate(overviewModule);
                }
              }}
              className="flex items-center gap-1 select-none text-left"
              aria-label="Open dashboard overview"
            >
              <span className="font-display text-xl tracking-tight">
                <span className="text-brand-red font-black">H</span>
                {!collapsed && (
                  <>
                    <span className={isDoctor ? "text-white font-extrabold" : "text-slate-950 font-extrabold"}>ealth</span>
                    <span className="text-brand-teal font-black">K</span>
                    <span className={isDoctor ? "text-white font-extrabold" : "text-slate-950 font-extrabold"}>o</span>
                  </>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleCollapsed}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${isDoctor ? "border-slate-800 text-slate-300" : "border-slate-200 text-slate-600"}`}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <CollapseIcon collapsed={collapsed} />
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeModule === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                    isActive ? "bg-brand-teal text-white shadow-sm shadow-brand-teal/20" : navIdle
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-current/10">
                    <NavIcon id={item.id} />
                  </span>
                  {!collapsed && <span className="min-w-0 flex-1 leading-tight">{item.label}</span>}
                  {!collapsed && item.badge ? (
                    <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-black text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={`space-y-4 border-t pt-5 ${isDoctor ? "border-slate-850" : "border-slate-200"}`}>
          {!collapsed && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">
                {isDoctor ? "Clinical account" : "Patient account"}
              </p>
              <p className="mt-1 text-sm font-black">{profile.name}</p>
              <p className={`text-xs font-semibold ${muted}`}>{profile.detail}</p>
              {profile.meta && <p className={`mt-1 text-[10px] font-bold ${muted}`}>{profile.meta}</p>}
            </div>
          )}
          {onLogout()}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className={`sticky top-0 z-30 border-b ${isDoctor ? "border-slate-850 bg-slate-950/90" : "border-slate-200 bg-white/90"} px-4 py-3 backdrop-blur lg:px-8`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">
                {subtitle}
              </p>
              <h1 className="mt-1 font-display text-2xl font-black tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                  connectionState === "connected"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : connectionState === "reconnecting"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-brand-red/20 bg-brand-red/10 text-brand-red"
                }`}
                aria-live="polite"
              >
                {connectionState === "connected" ? "Realtime online" : connectionState === "reconnecting" ? "Reconnecting" : "Offline"}
              </span>
            </div>
          </div>

          {connectionState !== "connected" && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800" role="status">
              Live updates are reconnecting. Your current work is still visible.
            </div>
          )}

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Mobile module navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${
                  activeModule === item.id ? "bg-brand-teal text-white" : isDoctor ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-600"
                }`}
              >
                <NavIcon id={item.id} />
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
