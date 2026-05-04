import type { ControlApi } from "@shared/ipc";
import { mockControlApi } from "../data/mock";

export function getControlApi(): ControlApi {
  return window.control ?? mockControlApi;
}

