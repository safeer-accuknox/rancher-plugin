import AppliedPolicies from '../pages/c/_cluster/accuknox/AppliedPolicies.vue';

const ACCUKNOX = 'accuknox';

const routes = [
  {
    name:      `c-cluster-${ACCUKNOX}-policies`,
    path:      `/c/:cluster/${ACCUKNOX}/policies`,
    component: AppliedPolicies,
    meta:      {
      product: ACCUKNOX,
      pkg:     'accuknox-ui-ext'
    }
  }
];

export default routes;
