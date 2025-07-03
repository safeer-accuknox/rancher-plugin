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
    labelKey: "accuknox.appliedPolicies",
    name: "accuknox-policies",
    namespaced: false,
    route: {
      name: `c-cluster-${ACCUKNOX}-policies`,
      params: { product: ACCUKNOX },
      meta: { pkg: "accuknox-ui-ext", product: ACCUKNOX },
    },
  });

  basicType([
    "accuknox-policies"
  ]);
}
