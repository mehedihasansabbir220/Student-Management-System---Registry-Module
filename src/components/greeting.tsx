"use client";

import { useEffect, useState } from "react";
import { greeting } from "@/lib/greeting";

/**
 * The server renders a neutral "Hello" (its clock is UTC when hosted); the
 * browser swaps in a greeting for the viewer's own local time after mount.
 */
export function Greeting({ name }: { name: string }) {
  const [text, setText] = useState("Hello");
  useEffect(() => setText(greeting(new Date().getHours())), []);
  return <>{`${text}, ${name}`}</>;
}
