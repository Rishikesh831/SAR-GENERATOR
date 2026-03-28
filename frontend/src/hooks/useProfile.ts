import { useContext } from "react";
import { ProfileContext, ProfileContextValue } from "@/context/ProfileContext";

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
