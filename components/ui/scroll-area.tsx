"use client";

// ScrollArea (base shadcn/ui + Radix) com scrollbar da marca:
// thumb dourado translucido em pill, track transparente, ~6px. Sem barra branca.

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

export function ScrollArea({
  className = "",
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      className={"relative overflow-hidden " + className}
      scrollHideDelay={600}
      {...props}
    >
      {/* [&>div]:!block corrige o display:table interno do Radix, que senao
          quebra o truncate e faz o texto vazar pra fora do painel. */}
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block [&>div]:!min-w-0">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  orientation = "vertical",
}: {
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={
        "flex touch-none select-none transition-opacity duration-200 " +
        (orientation === "vertical" ? "h-full w-1.5 p-[1px]" : "h-1.5 flex-col p-[1px]")
      }
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className="relative flex-1 rounded-full"
        style={{ background: "rgba(231,207,148,0.4)" }}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}
