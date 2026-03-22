import React from "react";
import { IonBadge } from "@ionic/react";

import { Aed } from "../../domain/models/Aed";

interface ScheduleBadgeProps {
  schedule: Aed["schedule"];
}

function isOpenNow(schedule: Aed["schedule"]): boolean {
  if (!schedule) return false;
  if (schedule.has_24h_surveillance) return true;
  const now = new Date();
  const dayOfWeek = now.getDay();

  let opening: string | null = null;
  let closing: string | null = null;

  if (dayOfWeek === 0) {
    // Sunday
    opening = schedule.sunday_opening ?? null;
    closing = schedule.sunday_closing ?? null;
  } else if (dayOfWeek === 6) {
    // Saturday
    opening = schedule.saturday_opening ?? null;
    closing = schedule.saturday_closing ?? null;
  } else {
    // Weekday
    opening = schedule.weekday_opening ?? null;
    closing = schedule.weekday_closing ?? null;
  }

  if (!opening || !closing) return false;
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

  const open = isOpenNow(schedule);

  return <IonBadge color={open ? "success" : "medium"}>{open ? "Abierto" : "Cerrado"}</IonBadge>;
};

export default ScheduleBadge;
