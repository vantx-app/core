import {
  Map,
  LayoutDashboard as Dashboard,
  CircleUser,
  Car,
  Building2,
  Users,
  Shield,
  Settings,
  FileText,
} from "lucide-react";
import { ROLES } from "../enums";
import { NavLink } from "@/types";

export const NAV_LINKS: NavLink[] = [
  {
    href: "/",
    label: "Dashboard",
    key: "nav.dashboard",
    icon: Dashboard,
    allowedRoles: [ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  },
  {
    href: "/map",
    label: "Mapa",
    key: "nav.map",
    icon: Map,
    allowedRoles: [ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  },
  {
    href: "/reports",
    label: "Reportes",
    key: "nav.reports",
    icon: FileText,
    allowedRoles: [ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  },

  {
    href: "/organizations",
    label: "Organizaciones",
    key: "nav.admin", // fallback
    icon: Building2,
    allowedRoles: [ROLES.SUPER_ADMIN],
    hidden: true,
  },
  {
    href: "/admin",
    label: "Administración",
    key: "nav.admin",
    icon: Settings,
    allowedRoles: [ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  },
  {
    href: "/vehicle",
    label: "Vehículos",
    key: "nav.dashboard", // fallback
    icon: Car,
    allowedRoles: [ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
    hidden: true,
  },
  {
    href: "/drivers",
    label: "Conductores",
    key: "nav.dashboard", // fallback
    icon: Users,
    allowedRoles: [ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
    hidden: true,
  },
  {
    href: "/users",
    label: "Usuarios",
    key: "nav.admin", // fallback
    icon: Shield,
    allowedRoles: [ROLES.OWNER, ROLES.SUPER_ADMIN],
    hidden: true,
  },
  {
    href: "/account",
    label: "Cuenta",
    key: "nav.account",
    icon: CircleUser,
    allowedRoles: [ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
    overrideClassNames: "mt-auto",
  },
];
