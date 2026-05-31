import { useMemo } from "react";

import { getControlApi } from "../api/controlApi";

export function useControlApi() {
  return useMemo(() => getControlApi(), []);
}
