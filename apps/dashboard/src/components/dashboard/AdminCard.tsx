import { AdminCardProps } from "@/types";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function AdminCard({
  href,
  icon: Icon,
  iconColorClass,
  title,
  description,
  disabled = false,
  disabledBadge,
  disabledDescription,
  disabledTitleAttr,
  isExternalLink = false,
}: AdminCardProps) {
  const LinkComponent = isExternalLink ? "a" : Link;

  if (disabled) {
    return (
      <div
        className="card bg-base-100/30 border border-base-200/50 shadow-md opacity-60 flex flex-col justify-between cursor-not-allowed select-none relative"
        title={disabledTitleAttr}
      >
        <div className="card-body p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-base-300 text-base-content/40 rounded-2xl">
              <Icon className="size-6" />
            </div>
            {disabledBadge && (
              <span className="badge badge-sm badge-ghost text-xs font-bold">
                {disabledBadge}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-base-content/50">{title}</h2>
            <p className="text-xs text-base-content/40 mt-1">
              {disabledDescription || description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LinkComponent
      href={href}
      className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md hover:shadow-2xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between"
    >
      <div className="card-body p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div
            className={`p-3 rounded-2xl transition-all duration-300 ${iconColorClass}`}
          >
            <Icon className="size-6" />
          </div>
          <ChevronRight className="size-5 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-base-content">{title}</h2>
          <p className="text-xs text-base-content/50 mt-1">{description}</p>
        </div>
      </div>
    </LinkComponent>
  );
}
