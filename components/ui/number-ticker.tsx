"use client";

// NumberTicker (baseado no Magic UI) — anima o número contando até o valor
// quando entra na tela. Adaptado pra pt-BR, com prefixo/sufixo/casas decimais.

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

export function NumberTicker({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  delay = 0,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const inView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(t);
  }, [inView, value, delay, motionValue]);

  useEffect(() => {
    return spring.on("change", (v) => {
      if (!ref.current) return;
      const n = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(Number(v.toFixed(decimals)));
      ref.current.textContent = prefix + n + suffix;
    });
  }, [spring, decimals, prefix, suffix]);

  return (
    <span ref={ref} className={"inline-block tabular-nums " + (className ?? "")}>
      {prefix}
      {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(0)}
      {suffix}
    </span>
  );
}
