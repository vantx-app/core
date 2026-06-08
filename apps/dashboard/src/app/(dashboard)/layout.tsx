import Link from "next/link";
import { NavigationMenu } from "@/components/NavigationMenu";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AuthProvider } from "@/context/AuthContext";
import { FleetProvider } from "@/context/FleetContext";
import { fetchServer } from "@/utils/server/api-server";
import { getUserRole } from "@/utils/server";
import { Suspense } from "react";
import { ImpersonationBanner } from "@/components/dashboard/ImpersonationBanner";
import { Logo } from "@/components/Logo";
import { SubscriptionGateClient } from "@/components/dashboard/SubscriptionGateClient";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = await getUserRole();
  let initialVehicles = [];
  let profile = null;

  try {
    initialVehicles = await fetchServer("/vehicles?liveState=true");
  } catch (error) {
    console.error("Error fetching initial vehicles for layout:", error);
  }

  try {
    profile = await fetchServer("/users/me");
  } catch (error) {
    console.error("Error fetching initial profile for layout:", error);
  }

  return (
    <AuthProvider role={role} initialProfile={profile}>
      <SubscriptionGateClient />
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-base-100">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        }
      >
        <FleetProvider initialVehicles={initialVehicles}>
          <div className="group flex h-dvh overflow-hidden bg-base-100 flex-col lg:flex-row">
            {/* DESKTOP SIDEBAR */}
            <aside className="hidden lg:flex w-64 flex-col bg-base-100 shrink-0 border-r border-base-300 z-20">
              <div className="p-4 border-b border-base-300">
                <Logo size="md" />
              </div>
              <Suspense fallback={<div className="flex-1 bg-base-100" />}>
                <NavigationMenu />
              </Suspense>
            </aside>
            {/* MOBILE TOP NAVBAR */}
            <nav className="navbar bg-base-100 lg:hidden shrink-0 z-20 shadow-sm flex items-center justify-between px-4 border-b border-base-300">
              <Link href="/" className="px-2">
                <Logo size="sm" />
              </Link>
            </nav>
            {/* MAIN CONTENT */}
            <main className="flex-1 relative overflow-y-auto pb-36 lg:pb-0 z-10">
              <Suspense fallback={null}>
                <ImpersonationBanner />
              </Suspense>
              {children}
            </main>
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
          </div>
        </FleetProvider>
      </Suspense>
    </AuthProvider>
  );
}
