import { ImageResponse } from "next/og";
import { AmethystGem } from "@/app/_components/amethyst-gem";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AmethystGem />, size);
}
