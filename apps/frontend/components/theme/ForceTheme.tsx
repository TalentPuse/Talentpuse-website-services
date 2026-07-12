"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export function ForceTheme({ theme }: { theme: "dark" | "light" }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);
  return null;
}
