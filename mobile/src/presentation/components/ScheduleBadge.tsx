import React from "react";
import { IonBadge } from "@ionic/react";

import { Aed } from "../../domain/models/Aed";

interface ScheduleBadgeProps {
  schedule: Aed["schedule"];
}

function isOpenNow(opening: string | null, closing: string | null): boolean {
  if (!opening || !closing) return false;
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Weekday-only schedule: closed on weekends (0 = Sunday, 6 = Saturday)
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const [openH, openM] = opening.split(":").map(Number);
  const [closeH, closeM] = closing.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

const ScheduleBadge: React.FC<ScheduleBadgeProps> = ({ schedule }) => {
  if (!schedule) return null;

  if (schedule.has_24h_surveillance) {
    return <IonBadge color="success">24h</IonBadge>;
  }

  const open = isOpenNow(schedule.weekday_opening, schedule.weekday_closing);

  return <IonBadge color={open ? "success" : "medium"}>{open ? "Abierto" : "Cerrado"}</IonBadge>;
};

export default ScheduleBadge;
