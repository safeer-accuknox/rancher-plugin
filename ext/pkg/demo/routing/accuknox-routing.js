// ./routing/extension-routing.ts
// definition of a "blank cluster" in Rancher Dashboard
const BLANK_CLUSTER = '_';

import Dashboard from '../pages/Dashboard.vue';

// to achieve naming consistency throughout the extension
// we recommend this to be defined on a config file and exported
// so that the developer can import it wherever it needs to be used
const YOUR_PRODUCT_NAME = 'accuknox';
const CUSTOM_PAGE_NAME = 'Dashboard';

const routes = [
  // this covers the "custom page"
  {
    name:      `${ YOUR_PRODUCT_NAME }-c-cluster-${ CUSTOM_PAGE_NAME }`,
    path:      `/${ YOUR_PRODUCT_NAME }/c/:cluster/${ CUSTOM_PAGE_NAME }`,
    component: Dashboard,
    meta:      {
      product: YOUR_PRODUCT_NAME,
      cluster: BLANK_CLUSTER
    },
  },
];

export default routes;