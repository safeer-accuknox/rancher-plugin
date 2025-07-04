<script>
import InstallView from '../../../../components/Dashboard/InstallView';
import { SERVICE } from '@shell/config/types';
import { RANCHER_CONST, ACCUKNOX_CONST } from '../../../../types/accuknox';

export default {
  name: 'Dashboard',

  components: { InstallView },

  async fetch() {
    if ( this.$store.getters['cluster/canList'](SERVICE) ) {
      this.allServices = await this.$store.dispatch('cluster/findAll', { type: SERVICE }, { root: true });
    }
  },

  data() {
    return {
      allServices: null,
      index: -1
    }
  },

  computed: {
    uiService() {
      if ( Array.isArray(this.allServices) && this.allServices.length ) {
        return this.allServices.find(svc => svc?.id?.includes(ACCUKNOX_CONST.AGENT_SERVICE));
      }

      return null;
    },
  }
};
</script>

<template>
  <InstallView v-if="!uiService" :ui-service="uiService" />
</template>
