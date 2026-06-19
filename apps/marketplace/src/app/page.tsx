import React from "react";
import type { Metadata } from "next";
import { fetchServer } from "../utils/server/api-server";
import { MarketplaceClientView } from "../components/MarketplaceClientView";

export const metadata: Metadata = {
  title: "Inicio",
  description:
    "Busca y contrata conductores calificados en tiempo real. Filtra por experiencia, ubicación, tipo de licencia y Driver Score verificado.",
  alternates: {
    canonical: "https://vantx.app/marketplace",
  },
};

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
    const isUserDriver = user.role === "DRIVER" || !!user.driver;
    const isUserOwner =
      user.role === "OWNER" ||
      user.role === "ADMIN" ||
      user.role === "SUPER_ADMIN";

    if (isUserDriver) {
      try {
        driverStats = await fetchServer("/drivers/me/stats");
      } catch (err) {
        console.error(
          "Marketplace: error fetching driver stats on server:",
          err,
        );
      }
    }

    if (isUserOwner) {
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
      initialDrivers = await fetchServer("/marketplace/drivers/public");
    } catch (err) {
      console.error(
        "Marketplace: error fetching public drivers list on server:",
        err,
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased relative flex flex-col overflow-x-hidden">
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
