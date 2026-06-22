import React from "react";
import type { Metadata } from "next";
import { fetchServer } from "../../../utils/server/api-server";
import { MarketplaceDriverProfileView } from "../../../components/MarketplaceDriverProfileView";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { maskDriverName } from "../../../utils/client/format";

interface DriverProfilePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: DriverProfilePageProps): Promise<Metadata> {
  const { id } = await params;
  let user = null;
  let driver = null;

  try {
    user = await fetchServer("/users/me");
  } catch (err) {
    // Guest access
  }

  try {
    const endpoint = user
      ? `/drivers/${id}`
      : `/marketplace/drivers/public/${id}`;
    driver = await fetchServer(endpoint);
  } catch (err) {
    // Fail silently to use fallback
  }

  if (!driver) {
    return {
      title: "Conductor No Encontrado",
      description:
        "El conductor solicitado no existe o no tienes permisos para verlo.",
    };
  }

  const name = maskDriverName(driver, user?.role);
  const score =
    driver.globalStats?.globalOverallScore || driver.globalStats?.overallScore;
  const scoreText = score
    ? `con un Driver Score verificado de ${score}/100`
    : "con Driver Score certificado";
  const experienceText = driver.experienceYears
    ? ` y ${driver.experienceYears} años de experiencia`
    : "";
  const desc = `Perfil profesional del conductor verificado ${name}${experienceText}, disponible en el marketplace de VantX ${scoreText}.`;

  return {
    title: name,
    description: desc,
    openGraph: {
      title: `${name} | Conductor Certificado | VantX Marketplace`,
      description: desc,
      url: `https://vantx.app/marketplace/drivers/${id}`,
      type: "profile",
      firstName: driver.firstName || undefined,
      lastName: driver.lastName || undefined,
    },
    twitter: {
      card: "summary",
      title: `${name} | Conductor Certificado`,
      description: desc,
    },
    alternates: {
      canonical: `https://vantx.app/marketplace/drivers/${id}`,
    },
  };
}

export default async function DriverProfilePage({
  params,
}: DriverProfilePageProps) {
  const { id } = await params;
  let user = null;
  let driver = null;
  let errorMsg = null;

  // 1. Fetch user profile
  try {
    user = await fetchServer("/users/me");
  } catch (err) {
    console.log("Marketplace Profile: public guest user access.");
  }

  // 2. Fetch target driver details
  try {
    const endpoint = user
      ? `/drivers/${id}`
      : `/marketplace/drivers/public/${id}`;
    driver = await fetchServer(endpoint);
  } catch (err: any) {
    console.error(
      "Marketplace Profile: error fetching driver stats on server:",
      err,
    );
    errorMsg =
      "No se pudo cargar el perfil del conductor. Esto puede deberse a que no tienes permisos de acceso o a que el conductor no existe.";
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased relative overflow-x-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] transform-gpu will-change-[transform,filter] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] transform-gpu will-change-[transform,filter] pointer-events-none" />

      {errorMsg || !driver ? (
        <div className="max-w-3xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center min-h-[70vh]">
          <div className="p-4 bg-red-50 text-red-500 rounded-full mb-4">
            <span className="text-xl font-bold">⚠️</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">
            Acceso Restringido o No Encontrado
          </h2>
          <p className="text-slate-500 text-sm max-w-md mb-6">
            {errorMsg || "Conductor no encontrado."}
          </p>
        </div>
      ) : (
        <MarketplaceDriverProfileView initialUser={user} driver={driver} />
      )}
    </main>
  );
}
