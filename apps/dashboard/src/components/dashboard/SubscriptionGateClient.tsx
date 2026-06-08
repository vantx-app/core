"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";

export function SubscriptionGateClient() {
  const router = useRouter();
  const { profile, loadingProfile } = useAuth();

  useEffect(() => {
    if (loadingProfile || !profile) return;

    const isOwnerOrAdmin =
      profile.role === ROLES.OWNER || profile.role === ROLES.ADMIN;
    if (isOwnerOrAdmin) {
      const subStatus = profile.organization?.subscriptionStatus;
      const expiresAt = profile.organization?.subscriptionExpiresAt;
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : true;
      const hasActiveMainSubscription = subStatus === "ACTIVE" && !isExpired;
      const hasSubscribedVehicles =
        profile.organization?.vehicles?.some(
          (v: { subscriptionTier: string }) => v.subscriptionTier !== "NONE",
        ) ?? false;
      const hasAccess = hasActiveMainSubscription || hasSubscribedVehicles;

      if (!hasAccess) {
        router.push("/admin?tab=billing");
      }
    }
  }, [profile, loadingProfile, router]);

  return null;
}
