import { IPlugin } from "@shell/core/types";

export function init($plugin: IPlugin, store: any) {
  const ACCUKNOX = "accuknox";

  const opts = {
    name: ACCUKNOX,
    ifHaveGroup: "",
    ifHave: "",
  };

  store.commit("type-map/product", opts);

  const { product, virtualType, basicType } = $plugin.DSL(store, ACCUKNOX);

  product({
    icon: "pod_security",
    inStore: "cluster",
  });

  virtualType({
    labelKey: "accuknox.dashboard.name",
    name: "accuknox-dashboard",
    namespaced: false,
    route: {
      name: `c-cluster-${ACCUKNOX}-dashboard`,
      params: { product: ACCUKNOX },
      meta: { pkg: "demo", product: ACCUKNOX },
    },
  });

  basicType([
    "accuknox-dashboard"
  ]);
}
