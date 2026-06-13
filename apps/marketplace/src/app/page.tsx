import React from "react";
import { fetchServer } from "../utils/server/api-server";
import { MarketplaceClientView } from "../components/MarketplaceClientView";

export default async function MarketplaceHome() {
  let user = null;
  let driverStats = null;
  let initialDrivers = [];

  // 1. Fetch user profile
  try {
    user = await fetchServer("/users/me");
  } catch (err) {
    console.log("Marketplace: public guest user access.");
  }

  // 2. Fetch driver stats or available drivers list based on user role
  if (user) {
    if (user.role === "DRIVER" || user.driver) {
      try {
        driverStats = await fetchServer("/drivers/me/stats");
      } catch (err) {
        console.error(
          "Marketplace: error fetching driver stats on server:",
          err,
        );
      }
    } else {
      // Owner/Admin view
      try {
        initialDrivers = await fetchServer("/drivers?available=true");
      } catch (err) {
        console.error(
          "Marketplace: error fetching owner drivers list on server:",
          err,
        );
      }
    }
  } else {
    // Guest view
    try {
      initialDrivers = await fetchServer("/drivers/public");
    } catch (err) {
      console.error(
        "Marketplace: error fetching public drivers list on server:",
        err,
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased relative flex flex-col">
      {/* Decorative background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] transform-gpu will-change-[transform,filter] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] transform-gpu will-change-[transform,filter] pointer-events-none" />

      <MarketplaceClientView
        initialUser={user}
        initialDriverStats={driverStats}
        initialDrivers={initialDrivers}
      />
    </main>
  );
}
