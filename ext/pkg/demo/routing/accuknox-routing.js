import Dashboard from '../pages/c/_cluster/accuknox/Dashboard.vue';

const ACCUKNOX = 'accuknox';

const routes = [
  {
    name:      `c-cluster-${ACCUKNOX}-dashboard`,
    path:      `/c/:cluster/${ACCUKNOX}/dashboard`,
    component: Dashboard,
    meta:      {
      product: ACCUKNOX,
      pkg:     'accuknox-ui-ext'
    }
  }
];

export default routes;
