import React from "react";
import UserAvatar from "./UserAvatar";
import { useUserColors } from "../context/UserColorsContext";

interface UserBadgeProps {
  userId?: number | null;
  label?: string;
  size?: "xs" | "sm";
  className?: string;
}

const UserBadge: React.FC<UserBadgeProps> = ({ userId, label, size = "xs", className = "" }) => {
  const { appearanceOf } = useUserColors();
  if (userId == null) return null;
  const a = appearanceOf(userId);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border-2 border-border py-0.5 pl-0.5 pr-2 text-[11px] font-bold text-black ${className}`}
      style={{ backgroundColor: `${a.color.bg}33` }}
      title={label ? `${label}: ${a.name}` : a.name}
    >
      <UserAvatar appearance={a} size={size} />
      <span className="truncate">
        {label ? `${label} ` : ""}
        {a.name}
      </span>
    </span>
  );
};

export default UserBadge;
