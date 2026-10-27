import { Suspense } from "react";

import { MobileTabBar, MobileTopBar, Sidebar, StaticMobileTabBar } from "@/components/app/sidebar";
import { UserMenu } from "@/components/app/user-menu";
import { getCurrentUser } from "@/lib/dal/session";
import { db } from "@/lib/db/collections";
import { ROLE_LABELS } from "@/lib/domain/constants";
import { today } from "@/lib/domain/dates";

// The navigation renders immediately as part of the static shell; the user menu and
// badge counts stream in once the session has been read.
async function ShellData({ variant }: { variant: "sidebar" | "topbar" }) {
  const user = await getCurrentUser();
  if (!user) return variant === "sidebar" ? <Sidebar userMenu={null} placeholder /> : <MobileTopBar userMenu={null} />;
  const [followUps, triage] = await Promise.all([
    db.tasks().countDocuments({ status: "open", ownerId: user.id, dueOn: { $lte: today() } }),
    db.opportunities().countDocuments({ needsTriage: true, stage: "enquiry" }),
  ]);
  const menu = <UserMenu name={user.name} email={user.email} roleLabel={ROLE_LABELS[user.role]} />;
  const badges = { followUps, triage };
  return variant === "sidebar" ? <Sidebar badges={badges} userMenu={menu} /> : <MobileTopBar badges={badges} userMenu={menu} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<Sidebar userMenu={null} placeholder />}>
        <ShellData variant="sidebar" />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<MobileTopBar userMenu={null} />}>
          <ShellData variant="topbar" />
        </Suspense>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>
      <Suspense fallback={<StaticMobileTabBar />}>
        <MobileTabBar />
      </Suspense>
    </div>
  );
}
