import type { Snapshot } from "../../data/repository";
import type { Ulid } from "../../domain/ids/ulid";
import type { PrefValues } from "../../domain/model/prefs";
import { type AlertList, alertsOf } from "../../domain/projections/alerts";
import { localDayOf } from "../session/today";

/** alertsOf sobre o snapshot, com o dia local do aparelho. Unico ponto que as telas chamam. */
export function buildAlerts(
  data: Snapshot,
  prefs: PrefValues,
  localMemberId: Ulid | null,
  today: string,
): AlertList {
  return alertsOf({
    items: data.items,
    movements: data.movements,
    listMarks: data.listMarks,
    listExtras: data.listExtras,
    alertStates: data.alertStates,
    prefs,
    localMemberId,
    today,
    dayOf: localDayOf,
  });
}
