import { MobileDrawerProps } from "@/types";
import React from "react";
import { Drawer } from "vaul";
import { ArrowLeft, X } from "lucide-react";

export const MobileDrawer = ({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  onBack,
  onClose,
  headerRight,
  children,
  snapPoints,
  activeSnapPoint,
  setActiveSnapPoint,
  dismissible = true,
  modal = true,
  height = "100dvh",
  paddingBottom,
}: MobileDrawerProps) => {
  const finalPaddingBottom =
    paddingBottom ??
    (modal
      ? "calc(1.5rem + env(safe-area-inset-bottom))"
      : "calc(80px + env(safe-area-inset-bottom))");
  // Lock body scroll and handle pointer-events when drawer is open
  React.useEffect(() => {
    if (!open) return;

    if (modal) {
      document.body.style.overflow = "hidden";
    }

    // Workaround for Vaul / Radix UI Dialog modal={false} bug where pointer-events: none is applied to body.
    // If modal is false, we want the body to stay interactive.
    if (!modal) {
      const handleBodyPointerEvents = () => {
        if (document.body.style.pointerEvents === "none") {
          document.body.style.pointerEvents = "auto";
        }
      };

      handleBodyPointerEvents();
      const timeoutId = setTimeout(handleBodyPointerEvents, 50);

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "style") {
            if (document.body.style.pointerEvents === "none") {
              document.body.style.pointerEvents = "auto";
            }
          }
        });
      });

      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["style"],
      });

      return () => {
        clearTimeout(timeoutId);
        observer.disconnect();
        document.body.style.overflow = "";
        document.body.style.pointerEvents = "";
      };
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open, modal]);

  // Maintain stable references to callback functions to avoid effect re-triggering on parent re-renders
  const onOpenChangeRef = React.useRef(onOpenChange);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
    onCloseRef.current = onClose;
  });

  // Handle back button / history popstate to close the drawer
  React.useEffect(() => {
    if (!open) return;
    if (!dismissible) return;

    const stateKey = `drawer-${Math.random().toString(36).substring(2, 9)}`;

    // Push a new state so the next 'back' pops this state
    try {
      window.history.pushState({ drawerKey: stateKey }, "");
    } catch (e) {
      console.warn("Failed to push state to history:", e);
    }

    let isClosedByPopState = false;

    const handlePopState = (event: PopStateEvent) => {
      // If we popped out of our state, close the drawer
      if (!event.state || event.state.drawerKey !== stateKey) {
        isClosedByPopState = true;
        onOpenChangeRef.current(false);
        if (onCloseRef.current) onCloseRef.current();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      // If the drawer was closed by some other means (e.g., clicking backdrop, X button, or submit),
      // we need to pop the state we pushed to keep the history clean.
      if (!isClosedByPopState) {
        try {
          if (
            window.history.state &&
            window.history.state.drawerKey === stateKey
          ) {
            window.history.back();
          }
        } catch (e) {
          console.warn("Failed to pop state from history:", e);
        }
      }
    };
  }, [open, dismissible]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      dismissible={dismissible}
      modal={false}
    >
      <Drawer.Portal>
        {modal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] cursor-pointer pointer-events-auto"
            style={{ pointerEvents: "auto" }}
            onClick={() => onOpenChange(false)}
          />
        )}
        <Drawer.Content
          className={`bg-base-100 flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] focus:outline-none border-t border-base-300 ${
            modal ? "z-[90]" : "z-50"
          }`}
          style={{ height }}
          onPointerDownOutside={(e) => {
            if (!modal) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => {
            if (!modal) {
              e.preventDefault();
            }
          }}
        >
          {/* Drawer Inner Wrapper */}
          <div className="flex flex-col h-full overflow-hidden bg-base-100 rounded-t-[20px]">
            {/* Drag Handle & Header */}
            <div className="p-4 shrink-0 border-b border-base-200 bg-base-100/80 backdrop-blur-md sticky top-0 z-10 cursor-grab active:cursor-grabbing">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-base-300 mb-4" />

              <Drawer.Title className="font-bold text-lg flex items-center justify-between w-full">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {onBack && (
                    <button
                      onClick={onBack}
                      className="btn btn-sm btn-ghost btn-square -ml-2 shrink-0"
                    >
                      <ArrowLeft className="size-5" />
                    </button>
                  )}
                  {icon && (
                    <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                      {icon}
                    </div>
                  )}
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate leading-tight font-extrabold text-base-content">
                      {title}
                    </span>
                    {subtitle && (
                      <span className="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold mt-0.5 truncate">
                        {subtitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {headerRight}
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="btn btn-sm btn-ghost btn-square"
                    >
                      <X className="size-5" />
                    </button>
                  )}
                </div>
              </Drawer.Title>
            </div>

            {/* Scrollable Body */}
            <div
              className="flex-1 overflow-y-auto"
              data-vaul-no-drag
              style={{ paddingBottom: finalPaddingBottom }}
            >
              {children}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
