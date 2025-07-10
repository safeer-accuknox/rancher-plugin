<script>
import InstallView from '../../../../components/Dashboard/InstallView';
import { SERVICE, CATALOG, NAMESPACE } from '@shell/config/types';
import { ACCUKNOX_CONST } from '../../../../types/accuknox';
import Loading from '@shell/components/Loading';
import { handleGrowl } from '../../../../utils/handle-growl';

export default {
  name: 'Dashboard',
  components: { InstallView, Loading },

  async fetch() {
    if (this.$store.getters['cluster/canList'](SERVICE)) {
      this.allServices = await this.$store.dispatch('cluster/findAll', { type: SERVICE }, { root: true });
    }
  },

  data() {
    return {
      allServices: null,
      form: {
        accessKey: '', clusterName: '', tokenURL: '', spireHost: '', ppsHost: '', knoxGateway: '',
        admissionController: false, kyverno: false
      },
      isInstalling: false,
      showModal: false,
      allReposPresent: false,
      chartReady: false,
      url: window.location.origin,
      hardeningAvailable: false
    };
  },

  computed: {
    uiService() {
      return Array.isArray(this.allServices)
        ? this.allServices.find(svc => svc?.id?.includes(ACCUKNOX_CONST.AGENT_SERVICE))
        : null;
    },
    cluster() {
      return this.$store.getters['currentCluster'];
    }
  },

  async mounted() {
    await this.checkAllReposPresent();
    if (this.allReposPresent) {
      await this.checkChartAvailability('accuknox-charts');
    }

    this.hardeningAvailable = Boolean(this.allReposPresent && this.chartReady && this.uiService);
  },

  methods: {
    async checkAllReposPresent() {
      this.repos = await this.$store.dispatch('cluster/findAll', { type: CATALOG.CLUSTER_REPO }, { root: true });
      const requiredRepo = 'accuknox-charts';
      this.allReposPresent = this.repos.some(r => r.metadata?.name === requiredRepo);
    },

    async checkChartAvailability(repoName) {
      try {
        const response = await this.$store.dispatch('cluster/request', {
          url: `v1/catalog.cattle.io.clusterrepos/${repoName}?link=index`,
          method: 'GET'
        });
        this.chartReady = !!response?.entries;
      } catch {
        this.chartReady = false;
      }
    },

    openModalWithDefaults() {
      this.form = {
        accessKey: '',
        clusterName: this.cluster.id,
        tokenURL: 'cwpp.demo.accuknox.com',
        spireHost: 'spire.demo.accuknox.com',
        ppsHost: 'pps.demo.accuknox.com',
        knoxGateway: 'knox-gw.demo.accuknox.com:3000',
        admissionController: false,
        kyverno: false
      };
      this.showModal = true;
    },

    async installRepos() {
      const name = 'accuknox-charts';
      const allRepos = this.$store.getters['cluster/all'](CATALOG.CLUSTER_REPO);

      if (!allRepos.find(r => r.metadata?.name === name)) {
        try {
          const repoObj = await this.$store.dispatch('cluster/create', {
            type: CATALOG.CLUSTER_REPO,
            metadata: { name },
            spec: { url: 'http://demo-svc.cattle-ui-plugin-system:8080/charts', forceUpdate: 'true' }
          });
          await repoObj.save();
          await new Promise(r => setTimeout(r, 3000));
          await this.checkAllReposPresent();
          await this.checkChartAvailability(name);
        } catch (e) {
          handleGrowl({ error: e, store: this.$store });
        }
      }
    },

    getInstallConfig() {
      return [
        {
          name: 'accuknox-charts',
          chartName: 'kubearmor-operator',
          version: 'v1.5.7',
          installAfter: true,
          namespace: 'kubearmor',
          values: { autoDeploy: true }
        },
        {
          name: 'accuknox-charts',
          chartName: 'agents-chart',
          version: 'v0.10.5',
          installAfter: true,
          namespace: 'agents',
          values: {
            clusterName: this.form.clusterName,
            accessKey: this.form.accessKey,
            spireHost: this.form.spireHost,
            tokenURL: this.form.tokenURL,
            ppsHost: this.form.ppsHost,
            knoxGateway: this.form.knoxGateway,
            admissionController: { enabled: this.form.admissionController },
            kyverno: { enabled: this.form.kyverno }
          }
        }
      ];
    },

    async installHardeningChart() {
      const data = {
        charts: [
          {
            chartName: 'accuknox-cwpp-hardening-policies',
            version: '0.1.0',
            releaseName: 'accuknox-cwpp-hardening-policies',
            annotations: {
              'catalog.cattle.io/ui-source-repo-type': 'cluster',
              'catalog.cattle.io/ui-source-repo': 'accuknox-charts'
            },
            values: {}
          }
        ],
        namespace: 'kubearmor',
        projectId: this.cluster.projectId,
        timeout: '600s',
        wait: true
      };

      try {
        await this.$store.dispatch('cluster/request', {
          url: 'v1/catalog.cattle.io.clusterrepos/accuknox-charts?action=install',
          method: 'POST',
          data
        });
        this.$store.dispatch('growl/success', {
          title: 'Hardening Policies Installed',
          message: 'accuknox-cwpp-hardening-policies installed successfully'
        });
      } catch (e) {
        handleGrowl({ error: e, store: this.$store });
      }
    },

    async installCharts() {
      this.showModal = false;
      this.isInstalling = true;
      const charts = this.getInstallConfig();
      for (const chart of charts) {
        const data = {
          charts: [
            {
              chartName: chart.chartName,
              version: chart.version,
              releaseName: chart.chartName,
              annotations: {
                'catalog.cattle.io/ui-source-repo-type': 'cluster',
                'catalog.cattle.io/ui-source-repo': chart.name
              },
              values: {
                ...chart.values,
                global: {
                  cattle: {
                    clusterId: this.cluster.id,
                    clusterName: this.cluster.name,
                    systemProjectId: this.cluster.systemProjectId,
                    url: this.url
                  }
                }
              }
            }
          ],
          namespace: chart.namespace,
          projectId: this.cluster.projectId,
          timeout: '600s',
          wait: true
        };

        try {
          await this.$store.dispatch('cluster/request', {
            url: `v1/catalog.cattle.io.clusterrepos/${chart.name}?action=install`,
            method: 'POST',
            data
          });
        } catch (e) {
          handleGrowl({ error: e, store: this.$store });
        }
      }
    }
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else class="container">
    <div class="title p-10">
      <img src="../../../../assets/accuknox-logo.svg" height="64" class="mt-20 mb-10" />
      <h1 class="mb-20">{{ t('accuknox.title') }}</h1>
      <div class="description">{{ t('accuknox.dashboard.description') }}</div>

      <InstallView
        :ui-service="uiService"
        :chart-ready="chartReady"
        :all-repos-present="allReposPresent"
        :form="form"
        :is-installing="isInstalling"
        :show-modal="showModal"
        :hardening-available="hardeningAvailable"
        @install-repos="installRepos"
        @install-charts="installCharts"
        @open-modal="openModalWithDefaults"
        @close-modal="() => showModal = false"
        @install-hardening="installHardeningChart"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.container {
  .title {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin: 100px 0;
  }
  .description {
    line-height: 20px;
  }
}
</style>