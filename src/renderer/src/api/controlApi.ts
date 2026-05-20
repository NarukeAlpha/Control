import type { ControlApi } from "@shared/ipc";
import { mockControlApi } from "../data/mocks/api";

export function getControlApi(): ControlApi {
  return window.control ?? mockControlApi;
}
