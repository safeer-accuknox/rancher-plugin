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
    Loading,
  },

  mixins: [ResourceFetch],

  async fetch() {
    this.clusterId = this.$store.getters['clusterId'];
    this.clusterName = this.$store.getters['currentCluster']?.nameDisplay;
    this.url = window.location.origin;

    await this.$fetchType('management.cattle.io.project');
    const allProjects = this.$store.getters['management/all']('management.cattle.io.project');
    const clusterProjects = allProjects.filter(p => p.spec?.clusterName === this.clusterId);

    this.projectId = `${this.clusterId}/${clusterProjects[0].metadata.name}`
    this.systemProjectId = clusterProjects[1].metadata.name
  },

  data() {
    return {
      form: {
        joinToken: '',
        spireHost: '',
        ppsHost: '',
        knoxGateway: '',
        admissionController: false,
        kyverno: false,
      },
      showModal: false,
      isInstalling: false,
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

    async deploy() {
      this.isInstalling = true;

      const CLUSTER_REPO_TYPE = 'catalog.cattle.io.clusterrepo';
      const REPOS = [
        {
          name: 'kubearmor-charts',
          url: 'https://kubearmor.github.io/charts/',
          chartName: 'kubearmor',
          version: 'v1.5.7',
          installAfter: true,
          namespace: 'kubearmor',
          values: {}
        },
        {
          name: 'accuknox-agents',
          url: 'oci://public.ecr.aws/k9v9d5v2/agents-chart',
          chartName: 'agents-chart',
          version: 'v0.10.5',
          installAfter: true,
          namespace: 'agents',
          values: {
            joinToken: this.form.joinToken,
            spireHost: this.form.spireHost,
            ppsHost: this.form.ppsHost,
            knoxGateway: this.form.knoxGateway,
            admissionController: { enabled: this.form.admissionController },
            kyverno: { enabled: this.form.kyverno },
          }
        }
      ];

      await this.$fetchType(CATALOG.CLUSTER_REPO);
      const allRepos = this.$store.getters['cluster/all'](CLUSTER_REPO_TYPE);

      for (const repo of REPOS) {
        const { name, url, chartName, version, installAfter, namespace, values } = repo;
        await this.createNamespace(namespace);
        const found = allRepos.find(r => r.metadata?.name === name);

        if (!found) {
          try {
            const repoObj = await this.$store.dispatch('cluster/create', {
              type: CLUSTER_REPO_TYPE,
              metadata: { name },
              spec: { url, forceUpdate: 'true' }
            });

            await repoObj.save();
            await new Promise(r => setTimeout(r, 3000));
            await this.$store.dispatch('catalog/refresh');
          } catch (e) {
            handleGrowl({ error: e, store: this.$store });
            continue;
          }
        }

        if (installAfter) {
          try {
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
                    ...values,
                    global: {
                      cattle: {
                        clusterId: this.clusterId,
                        clusterName: this.clusterName,
                        systemProjectId: this.systemProjectId,
                        url: this.url,
                        rkePathPrefix: '',
                        rkeWindowsPathPrefix: ''
                      }
                    }
                  }
                }
              ],
              namespace,
              projectId: this.projectId,
              noHooks: false,
              timeout: '600s',
              wait: true,
              disableOpenAPIValidation: false,
              skipCRDs: false
            };

            await this.$store.dispatch('cluster/request', {
              url: `v1/catalog.cattle.io.clusterrepos/${name}?action=install`,
              method: 'POST',
              data
            });

          } catch (e) {
            handleGrowl({ error: e, store: this.$store });
          }
        }
      }

      this.isInstalling = false;
      this.showModal = false;
      this.debounceRefreshCharts?.(true);
    }
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else class="container">
    <div class="title p-10">
      <div class="logo mt-20 mb-10">
        <img src="../../assets/accuknox-logo.svg" height="64" />
      </div>
      <h1 class="mb-20">{{ t("accuknox.title") }}</h1>
      <div class="description">{{ t("accuknox.dashboard.description") }}</div>


        <div>
          <button @click="showModal = true" class="btn role-primary">
            Install Now
          </button>

          <!-- Custom Modal -->
          <div v-if="showModal" class="modal-overlay">
            <div class="modal-content">
              <h2>AccuKnox Agent Configuration</h2>

              <label>Join Token</label>
              <input v-model="form.joinToken" class="input" placeholder="Enter Join Token" />

              <label class="mt-4">Spire Host</label>
              <input v-model="form.spireHost" class="input" placeholder="spire.example.com" />

              <label class="mt-4">PPS Host</label>
              <input v-model="form.ppsHost" class="input" placeholder="pps.example.com" />

              <label class="mt-4">Knox Gateway</label>
              <input v-model="form.knoxGateway" class="input" placeholder="gateway.example.com" />

              <label class="mt-4">Enable Admission Controller</label>
              <input type="checkbox" v-model="form.admissionController" />

              <label class="mt-4">Enable Kyverno</label>
              <input type="checkbox" v-model="form.kyverno" />

              <div class="mt-6">
                <button class="btn role-primary" @click="deploy">
                  Install
                </button>
                <button class="btn ml-2" @click="showModal = false">Cancel</button>
              </div>
            </div>
          </div>
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 10px;
  min-width: 400px;
  text-align: center;
  box-shadow: 0 0 20px rgba(0,0,0,0.3);
}
</style>