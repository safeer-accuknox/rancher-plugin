import Dashboard from '../pages/c/_cluster/accuknox/Dashboard.vue';
import Policies from '../pages/c/_cluster/accuknox/Policies.vue';

const ACCUKNOX = 'accuknox';

const routes = [
  {
    name:      `c-cluster-${ACCUKNOX}-dashboard`,
    path:      `/c/:cluster/${ACCUKNOX}/dashboard`,
    component: Dashboard,
    meta:      {
      product: ACCUKNOX,
      pkg:     'demo'
    }
  },
  {
    name:      `c-cluster-${ACCUKNOX}-policies`,
    path:      `/c/:cluster/${ACCUKNOX}/policies`,
    component: Policies,
    meta:      {
      product: ACCUKNOX,
      pkg:     'demo'
    }
  }
];

export default routes;
