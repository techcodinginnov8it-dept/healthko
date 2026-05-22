"use client";

import { useCallback, useState } from "react";
import type { ModuleId } from "@/lib/dashboard/types";

export function useDashboardModule<TModule extends ModuleId>(defaultModule: TModule, validModules: readonly TModule[]) {
  const [activeModule, setActiveModule] = useState<TModule>(defaultModule);

  const navigate = useCallback(
    (module: TModule) => {
      if (!validModules.includes(module)) {
        return;
      }

      setActiveModule(module);
      const url = new URL(window.location.href);
      url.searchParams.set("module", module);
      window.history.replaceState(null, "", url.toString());
    },
    [validModules]
  );

  return [activeModule, navigate] as const;
}
