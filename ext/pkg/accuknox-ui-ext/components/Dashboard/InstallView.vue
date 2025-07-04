<script>
import { mapGetters } from 'vuex';
import debounce from 'lodash/debounce';

import { CATALOG, SERVICE } from '@shell/config/types';
import { NAMESPACE } from '@shell/config/types';
import { REPO_TYPE, REPO, CHART, VERSION } from '@shell/config/query-params';
import { allHash } from '@shell/utils/promise';
import ResourceFetch from '@shell/mixins/resource-fetch';

import { Banner } from '@components/Banner';
import Loading from '@shell/components/Loading';

import { ACCUKNOX_CHARTS } from '../../types/accuknox';
import { getLatestStableVersion } from '../../plugins/accuknox-class';
import { handleGrowl } from '../../utils/handle-growl';
import { refreshCharts } from '../../utils/chart';

export default {
  props: {
    uiService: {
      type:     Object,
      default:  () => {}
    }
  },

  components: {
    Banner,
    Loading
  },

  mixins: [ResourceFetch],

  async fetch() {
  const clusterId = this.$store.getters['clusterId'];
  const CLUSTER_REPO_TYPE = 'catalog.cattle.io.clusterrepo';
  const CATALOG_APP_TYPE = 'catalog.cattle.io.clusterapps';

  const REPOS = [
    {
      name: 'kubearmor-charts',
      url: 'https://kubearmor.github.io/charts/',
      chartName: 'kubearmor',
      version: 'v1.5.7',
      installAfter: true,
      namespace: 'kubearmor' 
    },
    {
      name: 'accuknox-agents',
      url: 'oci://public.ecr.aws/k9v9d5v2/agents-chart',
      chartName: 'agents-chart',
      version: 'v0.10.5',
      installAfter: true,
      namespace: 'agents' 
    }
  ];

  // Step 0: Fetch current repos
  await this.$fetchType(CATALOG.CLUSTER_REPO);
  const allRepos = this.$store.getters['cluster/all'](CLUSTER_REPO_TYPE);

  // Step 1: Create Namespace
  await this.createNamespace('kubearmor'); // or 'default', as needed

  for (const repo of REPOS) {
    const { name, url, chartName, version, installAfter, namespace } = repo;
    const found = allRepos.find(r => r.metadata?.name === name);

    if (!found) {
      try {
        const repoObj = await this.$store.dispatch('cluster/create', {
          type: CLUSTER_REPO_TYPE,
          metadata: { name },
          spec: {
            url,
            forceUpdate: 'true'
          }
        });

        await repoObj.save();
        console.log(`✅ Created repo: ${name}`);
        await new Promise(r => setTimeout(r, 3000));
        await this.$store.dispatch('catalog/refresh');
      } catch (e) {
        console.error(`❌ Failed to add repo ${name}`, e);
        handleGrowl({ error: e, store: this.$store });
        continue; // Skip installation
      }
    } else {
      console.log(`✅ Repo exists: ${name}`);
    }

    if (installAfter) {
      try {
        this.status = `Installing ${chartName}...`;

        const data = {
          charts: [
            {
              chartName,
              version,
              releaseName: chartName,
              annotations: {
                'catalog.cattle.io/ui-source-repo-type': 'cluster',
                'catalog.cattle.io/ui-source-repo': name
              },
              values: {
                global: {
                  cattle: {
                    clusterId: 'local',
                    clusterName: 'local',
                    systemProjectId: 'p-zprng',
                    url: 'https://172.20.0.2',
                    rkePathPrefix: '',
                    rkeWindowsPathPrefix: ''
                  }
                }
              }
            }
          ],
          namespace,
          projectId: 'local/p-txpth',
          noHooks: false,
          timeout: '600s',
          wait: true,
          disableOpenAPIValidation: false,
          skipCRDs: false
        };

        const res = await this.$store.dispatch('cluster/request', {
          url: `v1/catalog.cattle.io.clusterrepos/${name}?action=install`,
          method: 'POST',
          data
        });

        const opName = res?.metadata?.name || `helm-operation-${Math.random().toString(36).substring(7)}`;

        // ⏳ Wait for the operation to complete
        let opStatus = null;
        for (let i = 0; i < 60; i++) { // 60 x 5s = 5 minutes max wait
          const op = await this.$store.dispatch('cluster/find', {
            type: 'catalog.cattle.io.operation',
            id: `kubearmor/${opName}`
          });

          opStatus = op?.status?.conditions?.find(c => c.type === 'Completed')?.status;

          if (opStatus === 'True') break;
          console.log(`⌛ Waiting for ${chartName} install to finish...`);
          await new Promise(r => setTimeout(r, 5000));
        }

        if (opStatus === 'True') {
          console.log(`✅ Installed ${chartName}`);
        } else {
          throw new Error(`${chartName} install timed out`);
        }

      } catch (e) {
        console.error(`❌ Failed to install chart ${chartName}`, e);
        handleGrowl({ error: e, store: this.$store });
      }
    }
  }

  this.debouncedRefreshCharts?.(true);
},


  data() {
    return {
      debounceRefreshCharts: null,
      reloadReady: false,
      install: false,
    }
  },

  computed: {
    ...mapGetters(['currentCluster']),
    ...mapGetters({
      charts: 'catalog/charts', repos: 'catalog/repos', t: 'i18n/t'
    }),

    controllerChart() {
      if (this.accuknxoRepo) {
        return this.$store.getters['catalog/chart']({
          repoName: this.accuknxoRepo.id,
          repoType: 'cluster',
          chartName: ACCUKNOX_CHARTS.AGENTS
        });
      }

      return null;
    },

    accuknxoRepo() {
      const chart1 = this.charts?.find(chart => chart.chartName === ACCUKNOX_CHARTS.AGENTS);
      return this.repos?.find(repo => repo.id === chart1?.repoName);
    },
  },

  methods: {
    async createNamespace(ns) {
      const allNamespaces = this.$store.getters['cluster/all'](NAMESPACE);
      const nsTemplate = {
        type: NAMESPACE,
        metadata: { name: ns },
        disableOpenApiValidation: false
      };

      const existing = allNamespaces?.find(n => n?.metadata?.name === ns);

      if (!existing) {
        const nsResource = await this.$store.dispatch('cluster/create', nsTemplate);

        try {
          await nsResource.save();
        } catch (e) {
          this.errors.push(e);
        }
      }
    },
    chartRoute() {
      if (!this.controllerChart) {
        try {
          this.debouncedRefreshCharts();
        } catch (e) {
          handleGrowl({ error: e, store: this.$store });
          return;
        }
      }

      const {
        repoType, repoName, chartName, versions
      } = this.controllerChart;
      const latestStableVersion = getLatestStableVersion(versions);
      console.log("TEST1", latestStableVersion)
      if (latestStableVersion) {
        const query = {
          [REPO_TYPE]: repoType,
          [REPO]: repoName,
          [CHART]: chartName,
          [VERSION]: latestStableVersion.version
        };

        this.$router.push({
          name: 'c-cluster-apps-charts-install',
          params: { cluster: this.currentCluster?.id || '_' },
          query,
        });
      } else {
        const error = {
          _statusText: this.t('accuknox.dashboard.appInstall.versionError.title'),
          message: this.t('accuknox.dashboard.appInstall.versionError.message')
        };

        handleGrowl({ error, store: this.$store });
      }
    }
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else class="container">
    <div v-if="!install" class="title p-10">
      <div class="logo mt-20 mb-10">
        <img src="../../assets/accuknox-logo.svg" height="64" />
      </div>
      <h1 class="mb-20" data-testid="nv-install-title">
        {{ t("accuknox.title") }}
      </h1>
      <div class="description">
        {{ t("accuknox.dashboard.description") }}
      </div>
      <div class="chart-route" v-if="!uiService">
        <Loading v-if="!controllerChart && !reloadReady" mode="relative" class="mt-20" />
        <template v-else-if="!controllerChart && reloadReady">
          <Banner color="warning">
            <span class="mb-20">
              {{ t('accuknox.dashboard.appInstall.reload' ) }}
            </span>
            <button class="ml-10 btn btn-sm role-primary" @click="reload()">
              {{ t('generic.reload') }}
            </button>
          </Banner>
        </template>
        <template v-else>
          <button class="btn role-primary mt-20" data-testid="nv-app-install-button" :disabled="!controllerChart" @click.prevent="chartRoute">
            {{ t("accuknox.dashboard.appInstall.button") }}
          </button>
        </template>
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
