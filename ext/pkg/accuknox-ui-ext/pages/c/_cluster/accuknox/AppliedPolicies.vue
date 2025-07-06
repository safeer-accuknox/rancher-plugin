<script>
import InstallView from '../../../../components/Dashboard/InstallView';
import { SERVICE } from '@shell/config/types';
import { RANCHER_CONST, ACCUKNOX_CONST } from '../../../../types/accuknox';
import Loading from '@shell/components/Loading';

export default {
  name: 'Dashboard',

  components: { InstallView, Loading },

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
  <Loading v-if="$fetchState.pending" />
  <div v-else class="container">
    <div class="title p-10">
      <div class="logo mt-20 mb-10">
        <img src="../../../../assets/accuknox-logo.svg" height="64" />
      </div>
      <h1 class="mb-20">{{ t("accuknox.title") }}</h1>
      <div class="description">{{ t("accuknox.dashboard.description") }}</div>

    <InstallView v-if="!uiService" :ui-service="uiService" />
    <div v-else class="p-20 text-center">
      <h3 class="text-lg font-semibold text-green-600">
        ✅ AccuKnox CWPP is already activated.
      </h3>
    </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container {
  & .title {
    display: flex;
    flex-wrap: wrap;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    margin: 100px 0;
  }

  & .description {
    line-height: 20px;
  }

  & .chart-route {
    position: relative;
  }

  & .airgap-align {
    justify-content: start;
  }
}
</style>