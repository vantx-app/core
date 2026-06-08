"use client";

import { ROLES } from "@/utils/enums";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState } from "react";

const AuthContext = createContext<any>(undefined);

export function AuthProvider({
  children,
  role,
  initialProfile,
}: {
  children: React.ReactNode;
  role: ROLES;
  initialProfile: any;
}) {
  const [profile, setProfile] = useState<any>(initialProfile);

  return (
    <AuthContext.Provider
      value={{ role, profile, loadingProfile: false, setProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
