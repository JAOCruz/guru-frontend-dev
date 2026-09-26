import React from "react";
import type { Appearance } from "../lib/userColors";

const SIZES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-14 w-14 text-2xl",
} as const;

interface UserAvatarProps {
  appearance: Appearance;
  size?: keyof typeof SIZES;
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ appearance, size = "md", className = "" }) => (
  <span
    className={`inline-flex flex-shrink-0 items-center justify-center rounded-full border-2 border-border font-black leading-none ${SIZES[size]} ${className}`}
    style={{ backgroundColor: appearance.color.bg, color: appearance.color.text }}
    title={appearance.name}
  >
    {appearance.emoji ?? appearance.initial}
  </span>
);

export default UserAvatar;
