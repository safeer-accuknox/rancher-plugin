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
      const CLUSTER_REPO_TYPE = 'catalog.cattle.io.clusterrepo';

      const REPOS = [
        {
          name: 'kubearmor-charts',
          url: 'https://kubearmor.github.io/charts/',
          chartName: 'kubearmor',
          version: 'v1.5.7',
          installAfter: true,
          namespace: 'kubearmor',
          values: {
          }
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

      console.log(REPOS[1])

      // Step 0: Fetch current repos
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

            const res = await this.$store.dispatch('cluster/request', {
              url: `v1/catalog.cattle.io.clusterrepos/${name}?action=install`,
              method: 'POST',
              data
            });

            // const opName = res?.metadata?.name || `helm-operation-${Math.random().toString(36).substring(7)}`;

            // // ⏳ Wait for the operation to complete
            // let opStatus = null;
            // for (let i = 0; i < 60; i++) { // 60 x 5s = 5 minutes max wait
            //   const op = await this.$store.dispatch('cluster/find', {
            //     type: 'catalog.cattle.io.operation',
            //     id: `kubearmor/${opName}`
            //   });

            //   opStatus = op?.status?.conditions?.find(c => c.type === 'Completed')?.status;

            //   if (opStatus === 'True') break;
            //   console.log(`⌛ Waiting for ${chartName} install to finish...`);
            //   await new Promise(r => setTimeout(r, 5000));
            // }

            // if (opStatus === 'True') {
            //   console.log(`✅ Installed ${chartName}`);
            // } else {
            //   throw new Error(`${chartName} install timed out`);
            // }

          } catch (e) {
            console.error(`❌ Failed to install chart ${chartName}`, e);
            handleGrowl({ error: e, store: this.$store });
          }
        }
      }

      this.debouncedRefreshCharts?.(true);
    },
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

      <div class="form-section mt-10">
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

        <button class="btn role-primary mt-10" @click.prevent="deploy">
          {{ t("accuknox.dashboard.appInstall.button") }}
        </button>
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
