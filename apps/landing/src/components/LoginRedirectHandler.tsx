"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginRedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("login") === "true") {
      router.replace("/login");
    }
  }, [searchParams, router]);

  return null;
}
